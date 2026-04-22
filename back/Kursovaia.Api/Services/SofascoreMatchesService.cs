using System.Globalization;
using System.Text.Json;
using Kursovaia.Api.Models;

namespace Kursovaia.Api.Services;

public class SofascoreMatchesService
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    private readonly HttpClient _httpClient;
    private readonly ILogger<SofascoreMatchesService> _logger;

    private readonly object _cacheLock = new();
    private DateTime _cacheUntilUtc = DateTime.MinValue;
    private List<Match> _cachedMatches = new();

    public SofascoreMatchesService(HttpClient httpClient, ILogger<SofascoreMatchesService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<List<Match>> GetMatchesAsync(CancellationToken cancellationToken = default)
    {
        lock (_cacheLock)
        {
            if (DateTime.UtcNow < _cacheUntilUtc && _cachedMatches.Count > 0)
            {
                return _cachedMatches.Select(CloneForResponse).ToList();
            }
        }

        try
        {
            var matches = new List<Match>();
            matches.AddRange(await GetLiveEventsAsync(cancellationToken));
            matches.AddRange(await GetScheduledEventsAsync(cancellationToken));

            var deduped = matches
                .GroupBy(m => $"{m.HomeTeam.Name}-{m.AwayTeam.Name}-{m.Time}")
                .Select(g => g.First())
                .OrderByDescending(m => m.IsLive)
                .ThenBy(m => ParseMatchTime(m.Time))
                .Take(30)
                .ToList();

            if (deduped.Count == 0)
            {
                return new List<Match>();
            }

            lock (_cacheLock)
            {
                _cachedMatches = deduped;
                _cacheUntilUtc = DateTime.UtcNow.Add(CacheTtl);
            }

            return deduped.Select(CloneForResponse).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch matches from SofaScore");
            return new List<Match>();
        }
    }

    private async Task<List<Match>> GetLiveEventsAsync(CancellationToken cancellationToken)
    {
        const string liveUrl = "https://api.sofascore.com/api/v1/sport/football/events/live";

        using var response = await _httpClient.GetAsync(liveUrl, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return new List<Match>();
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        return ParseEvents(document, true);
    }

    private async Task<List<Match>> GetScheduledEventsAsync(CancellationToken cancellationToken)
    {
        var date = DateTime.UtcNow.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var scheduledUrl = $"https://api.sofascore.com/api/v1/sport/football/scheduled-events/{date}";

        using var response = await _httpClient.GetAsync(scheduledUrl, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return new List<Match>();
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        return ParseEvents(document, false);
    }

    private List<Match> ParseEvents(JsonDocument document, bool defaultLive)
    {
        if (!document.RootElement.TryGetProperty("events", out var eventsElement) || eventsElement.ValueKind != JsonValueKind.Array)
        {
            return new List<Match>();
        }

        var result = new List<Match>();

        foreach (var ev in eventsElement.EnumerateArray())
        {
            try
            {
                var homeName = ev.GetProperty("homeTeam").GetProperty("name").GetString() ?? "Home";
                var awayName = ev.GetProperty("awayTeam").GetProperty("name").GetString() ?? "Away";
                var league = ev.GetProperty("tournament").GetProperty("name").GetString() ?? "Football";

                var startTimestamp = ev.TryGetProperty("startTimestamp", out var tsEl) ? tsEl.GetInt64() : 0;
                var dateTime = DateTimeOffset.FromUnixTimeSeconds(startTimestamp).ToLocalTime().DateTime;
                var matchId = BuildMatchId(ev, homeName, awayName, startTimestamp);
                var statusType = ev.TryGetProperty("status", out var statusEl) && statusEl.TryGetProperty("type", out var typeEl)
                    ? typeEl.GetString()
                    : null;

                var isLive = defaultLive || string.Equals(statusType, "inprogress", StringComparison.OrdinalIgnoreCase);

                var score = "";
                if (ev.TryGetProperty("homeScore", out var hs) && ev.TryGetProperty("awayScore", out var aS)
                    && hs.TryGetProperty("current", out var hCur) && aS.TryGetProperty("current", out var aCur))
                {
                    score = $"{hCur.GetInt32()}:{aCur.GetInt32()}";
                }

                var odds = BuildPseudoOdds(homeName, awayName, dateTime);

                result.Add(new Match
                {
                    Id = matchId,
                    League = $"Football. {league}",
                    Time = isLive ? $"LIVE {dateTime:HH:mm}" : dateTime.ToString("dd.MM HH:mm", CultureInfo.InvariantCulture),
                    HomeTeam = new Team
                    {
                        Name = homeName,
                        Logo = BuildLogo(homeName),
                        Form = "N/A"
                    },
                    AwayTeam = new Team
                    {
                        Name = awayName,
                        Logo = BuildLogo(awayName),
                        Form = "N/A"
                    },
                    Odds = odds,
                    IsLive = isLive,
                    Score = string.IsNullOrWhiteSpace(score) ? null : score
                });
            }
            catch
            {
                
            }
        }

        return result;
    }

    private static int BuildMatchId(JsonElement ev, string homeName, string awayName, long startTimestamp)
    {
        if (ev.TryGetProperty("id", out var idEl) && idEl.ValueKind == JsonValueKind.Number)
        {
            if (idEl.TryGetInt32(out var id32) && id32 != 0)
            {
                return id32;
            }

            if (idEl.TryGetInt64(out var id64) && id64 != 0)
            {
                return unchecked((int)(id64 & 0x7FFFFFFF));
            }
        }

        var fallback = HashCode.Combine(homeName, awayName, startTimestamp);
        return fallback == 0 ? 1 : Math.Abs(fallback);
    }

    private static MatchOdds BuildPseudoOdds(string home, string away, DateTime start)
    {
        var seed = HashCode.Combine(home, away, start.Date, start.Hour);
        var rng = new Random(seed);

        var p1 = 1.6 + rng.NextDouble() * 2.8;
        var x = 2.8 + rng.NextDouble() * 1.8;
        var p2 = 1.7 + rng.NextDouble() * 3.2;

        return new MatchOdds
        {
            P1 = Math.Round(p1, 2),
            X = Math.Round(x, 2),
            P2 = Math.Round(p2, 2),
            LastUpdated = DateTime.Now
        };
    }

    private static string BuildLogo(string teamName)
    {
        if (string.IsNullOrWhiteSpace(teamName))
        {
            return "⚽";
        }

        var first = char.ToUpperInvariant(teamName.Trim()[0]);
        return first switch
        {
            >= 'A' and <= 'H' => "🔵",
            >= 'I' and <= 'P' => "🔴",
            >= 'Q' and <= 'Z' => "🟢",
            _ => "⚽"
        };
    }

    private static DateTime ParseMatchTime(string text)
    {
        if (text.StartsWith("LIVE", StringComparison.OrdinalIgnoreCase))
        {
            return DateTime.MinValue;
        }

        if (DateTime.TryParseExact(text, "dd.MM HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
        {
            return dt;
        }

        return DateTime.MaxValue;
    }

    private static Match CloneForResponse(Match source)
    {
        return new Match
        {
            Id = source.Id,
            League = source.League,
            Time = source.Time,
            HomeTeam = new Team
            {
                Id = source.HomeTeam.Id,
                Name = source.HomeTeam.Name,
                Logo = source.HomeTeam.Logo,
                Form = source.HomeTeam.Form
            },
            AwayTeam = new Team
            {
                Id = source.AwayTeam.Id,
                Name = source.AwayTeam.Name,
                Logo = source.AwayTeam.Logo,
                Form = source.AwayTeam.Form
            },
            Odds = new MatchOdds
            {
                Id = source.Odds.Id,
                MatchId = source.Odds.MatchId,
                P1 = source.Odds.P1,
                X = source.Odds.X,
                P2 = source.Odds.P2,
                LastUpdated = source.Odds.LastUpdated
            },
            IsLive = source.IsLive,
            Score = source.Score
        };
    }
}

using System.Globalization;
using System.Text.RegularExpressions;

namespace Kursovaia.Api.Services;

public class UnderstatXgService
{
    private static readonly Regex NumberRegex = new("\\\"(?<key>xG|xGA)\\\"\\s*:\\s*\\\"?(?<value>\\d+(?:\\.\\d+)?)", RegexOptions.Compiled);

    private readonly HttpClient _httpClient;
    private readonly ILogger<UnderstatXgService> _logger;

    public UnderstatXgService(HttpClient httpClient, ILogger<UnderstatXgService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<UnderstatXgResponse> GetExpectedGoalsAsync(
        string homeTeam,
        string awayTeam,
        double? p1,
        double? x,
        double? p2,
        CancellationToken cancellationToken = default)
    {
        var homeStats = await TryLoadTeamStatsAsync(homeTeam, cancellationToken);
        var awayStats = await TryLoadTeamStatsAsync(awayTeam, cancellationToken);

        if (homeStats != null && awayStats != null)
        {
            var homeXg = Clamp((homeStats.XgFor + awayStats.XgAgainst) / 2.0, 0.2, 4.0);
            var awayXg = Clamp((awayStats.XgFor + homeStats.XgAgainst) / 2.0, 0.2, 4.0);

            return new UnderstatXgResponse(
                Math.Round(homeXg, 2),
                Math.Round(awayXg, 2),
                "understat",
                "xG получен через публичные страницы Understat"
            );
        }

        var fallback = BuildOddsFallback(p1, x, p2);
        return new UnderstatXgResponse(
            Math.Round(fallback.HomeXg, 2),
            Math.Round(fallback.AwayXg, 2),
            "fallback-odds",
            "Understat недоступен для этих команд, использована оценка по коэффициентам"
        );
    }

    private async Task<TeamXgStats?> TryLoadTeamStatsAsync(string teamName, CancellationToken cancellationToken)
    {
        var slug = BuildSlug(teamName);
        if (string.IsNullOrWhiteSpace(slug))
        {
            return null;
        }

        var seasons = new[] { DateTime.UtcNow.Year, DateTime.UtcNow.Year - 1 };

        foreach (var season in seasons)
        {
            var url = $"https://understat.com/team/{Uri.EscapeDataString(slug)}/{season}";

            try
            {
                using var response = await _httpClient.GetAsync(url, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    continue;
                }

                var html = await response.Content.ReadAsStringAsync(cancellationToken);
                var stats = ExtractStatsFromHtml(html);
                if (stats != null)
                {
                    return stats;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Failed Understat fetch for {Team} ({Url})", teamName, url);
            }
        }

        return null;
    }

    private static TeamXgStats? ExtractStatsFromHtml(string html)
    {
        var xgValues = new List<double>();
        var xgaValues = new List<double>();

        foreach (Match match in NumberRegex.Matches(html))
        {
            var key = match.Groups["key"].Value;
            var raw = match.Groups["value"].Value;

            if (!double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var value))
            {
                continue;
            }

            if (value <= 0 || value > 8)
            {
                continue;
            }

            if (key == "xG") xgValues.Add(value);
            if (key == "xGA") xgaValues.Add(value);
        }

        if (xgValues.Count < 5 || xgaValues.Count < 5)
        {
            return null;
        }

        return new TeamXgStats(xgValues.Average(), xgaValues.Average());
    }

    private static (double HomeXg, double AwayXg) BuildOddsFallback(double? p1, double? x, double? p2)
    {
        if (!p1.HasValue || !x.HasValue || !p2.HasValue || p1 <= 1.0 || x <= 1.0 || p2 <= 1.0)
        {
            return (1.35, 1.15);
        }

        var h = 1.0 / p1.Value;
        var d = 1.0 / x.Value;
        var a = 1.0 / p2.Value;
        var sum = h + d + a;

        if (sum <= 0)
        {
            return (1.35, 1.15);
        }

        var hp = h / sum;
        var dp = d / sum;
        var ap = a / sum;

        var homeXg = 0.8 + hp * 2.2 + dp * 0.3;
        var awayXg = 0.8 + ap * 2.2 + dp * 0.3;

        return (Clamp(homeXg, 0.2, 4.0), Clamp(awayXg, 0.2, 4.0));
    }

    private static string BuildSlug(string teamName)
    {
        var chars = teamName
            .ToLowerInvariant()
            .Where(c => char.IsLetterOrDigit(c) || char.IsWhiteSpace(c) || c == '-' || c == '_')
            .ToArray();

        return string.Join("_", new string(chars).Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    private static double Clamp(double value, double min, double max)
    {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    private sealed record TeamXgStats(double XgFor, double XgAgainst);
}

public sealed record UnderstatXgResponse(double HomeXg, double AwayXg, string Source, string Note);

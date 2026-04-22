using Kursovaia.Api.Data;
using Kursovaia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Kursovaia.Api.Services;

public class OddsService
{
    private readonly IServiceProvider _services;
    private readonly SofascoreMatchesService _sofascoreMatchesService;
    private readonly ILogger<OddsService> _logger;
    private readonly Random _random = new();

    public OddsService(
        IServiceProvider services,
        SofascoreMatchesService sofascoreMatchesService,
        ILogger<OddsService> logger)
    {
        _services = services;
        _sofascoreMatchesService = sofascoreMatchesService;
        _logger = logger;
        _ = InitializeDataAsync().ContinueWith(t =>
        {
            if (t.IsFaulted)
            {
                _logger.LogWarning(t.Exception, "Failed to initialize local database. API will use SofaScore only.");
            }
        });
    }

    public async Task InitializeDataAsync()
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        try
        {
            await context.Database.MigrateAsync();
            await EnsureUserMatchColumnsAsync(context);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not migrate database. Continuing without local database.");
            return;
        }

        if (!await context.Teams.AnyAsync())
        {
            var teams = new List<Team>
            {
                new() { Name = "Bologna", Logo = "🔵", Form = "8-6-8" },
                new() { Name = "Milan", Logo = "🔴⚫", Form = "13-8-1" },
                new() { Name = "Bayer L", Logo = "🔴", Form = "8-6-8" },
                new() { Name = "St. Pauli", Logo = "⚪", Form = "13-8-1" },
                new() { Name = "Albacete", Logo = "⚪", Form = "8-6-8" },
                new() { Name = "Barcelona", Logo = "🔵🔴", Form = "13-8-1" }
            };

            context.Teams.AddRange(teams);
            await context.SaveChangesAsync();

            var matches = new List<Match>
            {
                new()
                {
                    League = "Football. Serie A",
                    Time = "Today 22:45",
                    HomeTeamId = teams[0].Id,
                    AwayTeamId = teams[1].Id,
                    Odds = new MatchOdds { P1 = 2.94, X = 3.09, P2 = 2.56 },
                    IsLive = false
                },
                new()
                {
                    League = "Football. Bundesliga",
                    Time = "Today 22:45",
                    HomeTeamId = teams[2].Id,
                    AwayTeamId = teams[3].Id,
                    Odds = new MatchOdds { P1 = 1.47, X = 4.59, P2 = 6.42 },
                    IsLive = false
                },
                new()
                {
                    League = "Football. La Liga",
                    Time = "Today 23:00",
                    HomeTeamId = teams[4].Id,
                    AwayTeamId = teams[5].Id,
                    Odds = new MatchOdds { P1 = 11.03, X = 7.22, P2 = 1.21 },
                    IsLive = false
                }
            };

            context.Matches.AddRange(matches);
            await context.SaveChangesAsync();
        }
    }

    public async Task<List<Match>> GetMatchesAsync()
    {
        var userCreatedMatches = await GetUserCreatedMatchesAsync();

        var realMatches = await _sofascoreMatchesService.GetMatchesAsync();
        if (realMatches.Count > 0)
        {
            realMatches.AddRange(userCreatedMatches);
            return realMatches;
        }

        _logger.LogWarning("SofaScore returned no matches. Attempting to fall back to local database matches.");

        try
        {
            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

            await EnsureUserMatchColumnsAsync(context);

            return await context.Matches
                .Include(m => m.HomeTeam)
                .Include(m => m.AwayTeam)
                .Include(m => m.Odds)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not fetch matches from database either. Returning empty list.");
            return new List<Match>();
        }
    }

    public async Task<(Match? Match, string? Error)> AddUserMatchAsync(
        int userId,
        string league,
        string time,
        string homeTeamName,
        string awayTeamName,
        double p1,
        double x,
        double p2)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        await EnsureUserMatchColumnsAsync(context);

        var userExists = await context.Users.AnyAsync(u => u.Id == userId);
        if (!userExists)
        {
            return (null, "User not found");
        }

        var homeTeam = await context.Teams.FirstOrDefaultAsync(t => t.Name == homeTeamName);
        if (homeTeam == null)
        {
            homeTeam = new Team { Name = homeTeamName, Logo = "⚽", Form = "-" };
            context.Teams.Add(homeTeam);
        }

        var awayTeam = await context.Teams.FirstOrDefaultAsync(t => t.Name == awayTeamName);
        if (awayTeam == null)
        {
            awayTeam = new Team { Name = awayTeamName, Logo = "⚽", Form = "-" };
            context.Teams.Add(awayTeam);
        }

        var existingMatch = await context.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.Odds)
            .FirstOrDefaultAsync(m =>
                m.IsUserCreated
                && m.CreatedByUserId == userId
                && m.League == league
                && m.Time == time
                && m.HomeTeam.Name == homeTeamName
                && m.AwayTeam.Name == awayTeamName);

        if (existingMatch != null)
        {
            return (existingMatch, null);
        }

        var match = new Match
        {
            League = league,
            Time = time,
            HomeTeam = homeTeam,
            AwayTeam = awayTeam,
            IsLive = false,
            IsUserCreated = true,
            CreatedByUserId = userId,
            Odds = new MatchOdds
            {
                P1 = p1,
                X = x,
                P2 = p2,
                LastUpdated = DateTime.Now
            }
        };

        context.Matches.Add(match);
        await context.SaveChangesAsync();

        return (match, null);
    }

    public async Task<List<Match>> GetUserCreatedMatchesByUserAsync(int userId)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        await EnsureUserMatchColumnsAsync(context);

        return await context.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.Odds)
            .Where(m => m.IsUserCreated && m.CreatedByUserId == userId)
            .ToListAsync();
    }

    public async Task<(Match? Match, string? Error)> UpdateUserMatchAsync(
        int userId,
        int matchId,
        string league,
        string time,
        string homeTeamName,
        string awayTeamName,
        double p1,
        double x,
        double p2)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        await EnsureUserMatchColumnsAsync(context);

        var match = await context.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.Odds)
            .FirstOrDefaultAsync(m => m.Id == matchId && m.IsUserCreated && m.CreatedByUserId == userId);

        if (match == null)
        {
            return (null, "Match not found");
        }

        var homeTeam = await context.Teams.FirstOrDefaultAsync(t => t.Name == homeTeamName);
        if (homeTeam == null)
        {
            homeTeam = new Team { Name = homeTeamName, Logo = "⚽", Form = "-" };
            context.Teams.Add(homeTeam);
        }

        var awayTeam = await context.Teams.FirstOrDefaultAsync(t => t.Name == awayTeamName);
        if (awayTeam == null)
        {
            awayTeam = new Team { Name = awayTeamName, Logo = "⚽", Form = "-" };
            context.Teams.Add(awayTeam);
        }

        match.League = league;
        match.Time = time;
        match.HomeTeam = homeTeam;
        match.AwayTeam = awayTeam;
        match.Odds.P1 = p1;
        match.Odds.X = x;
        match.Odds.P2 = p2;
        match.Odds.LastUpdated = DateTime.Now;

        await context.SaveChangesAsync();
        return (match, null);
    }

    private async Task<List<Match>> GetUserCreatedMatchesAsync()
    {
        try
        {
            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

            await EnsureUserMatchColumnsAsync(context);

            return await context.Matches
                .Include(m => m.HomeTeam)
                .Include(m => m.AwayTeam)
                .Include(m => m.Odds)
                .Where(m => m.IsUserCreated)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not fetch user-created matches from database.");
            return new List<Match>();
        }
    }

    private static Task EnsureUserMatchColumnsAsync(KursovaiaDbContext context)
    {
        return context.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Matches', 'IsUserCreated') IS NULL
BEGIN
    ALTER TABLE [Matches] ADD [IsUserCreated] bit NOT NULL CONSTRAINT [DF_Matches_IsUserCreated] DEFAULT(0);
END
IF COL_LENGTH('Matches', 'CreatedByUserId') IS NULL
BEGIN
    ALTER TABLE [Matches] ADD [CreatedByUserId] int NULL;
END");
    }

    public async Task UpdateOddsAsync(int matchId, Dictionary<string, double> newOdds)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        var odds = await context.MatchOdds.FirstOrDefaultAsync(o => o.MatchId == matchId);
        if (odds != null)
        {
            if (newOdds.TryGetValue("P1", out var p1)) odds.P1 = p1;
            if (newOdds.TryGetValue("X", out var x)) odds.X = x;
            if (newOdds.TryGetValue("P2", out var p2)) odds.P2 = p2;
            odds.LastUpdated = DateTime.Now;
            await context.SaveChangesAsync();
        }
    }

    public async Task SimulateOddsChangesAsync()
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        var oddsList = await context.MatchOdds.ToListAsync();
        foreach (var odds in oddsList)
        {
            var change = 1 + (_random.NextDouble() - 0.5) * 0.1;
            odds.P1 *= change;
            odds.X *= change;
            odds.P2 *= change;
            odds.LastUpdated = DateTime.Now;
        }

        await context.SaveChangesAsync();
    }

    public object CalculateValue(double bookmakerOdd, double yourProbability)
    {
        var impliedProbability = (1 / bookmakerOdd) * 100;
        var trueOdd = 100 / yourProbability;
        var value = (yourProbability * bookmakerOdd) / 100 - 1;

        string recommendation = value switch
        {
            > 0.05 => "Value bet - recommended",
            > -0.05 => "Neutral",
            _ => "No value"
        };

        return new
        {
            BookmakerOdd = bookmakerOdd,
            ImpliedProbability = Math.Round(impliedProbability, 2),
            YourProbability = yourProbability,
            TrueOdd = Math.Round(trueOdd, 2),
            Value = Math.Round(value, 3),
            Recommendation = recommendation,
            IsValue = value > 0
        };
    }
}
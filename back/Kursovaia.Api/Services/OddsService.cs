using Kursovaia.Api.Data;
using Kursovaia.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Kursovaia.Api.Services;

public class OddsService
{
    private readonly IServiceProvider _services;
    private readonly Random _random = new();

    public OddsService(IServiceProvider services)
    {
        _services = services;
        InitializeDataAsync().Wait();
    }

    private async Task InitializeDataAsync()
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();
        
        await context.Database.MigrateAsync();

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
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();
        
        return await context.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.Odds)
            .ToListAsync();
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
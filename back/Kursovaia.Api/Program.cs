using Kursovaia.Api.Common;
using Kursovaia.Api.Data;
using Kursovaia.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy(AppCommon.CorsPolicyName, policy =>
    {
        policy.SetIsOriginAllowed(origin =>
              {
                  if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                  {
                      return false;
                  }

                  var isLocalHost = uri.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                                    || uri.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);

                  return isLocalHost && uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase);
              })
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddDbContext<KursovaiaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<OddsService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<ExcelService>();
builder.Services.AddHttpClient<SofascoreMatchesService>();
builder.Services.AddHttpClient<UnderstatXgService>();
builder.Services.AddHostedService<OddsBackgroundService>();

var app = builder.Build();

app.UseCors(AppCommon.CorsPolicyName);

// Matches API
app.MapGet(AppCommon.Routes.Matches, async (OddsService service) => 
    Results.Ok(await service.GetMatchesAsync()));

app.MapPost(AppCommon.Routes.Calculate, (CalculateRequest request, OddsService service) =>
{
    var result = service.CalculateValue(request.BookmakerOdd, request.YourProbability);
    return Results.Ok(result);
});

app.MapPost(AppCommon.Routes.UserMatches, async (int userId, CreateUserMatchRequest request, OddsService service) =>
{
    if (string.IsNullOrWhiteSpace(request.League)
        || string.IsNullOrWhiteSpace(request.Time)
        || string.IsNullOrWhiteSpace(request.HomeTeam)
        || string.IsNullOrWhiteSpace(request.AwayTeam))
    {
        return Results.BadRequest("League, time, homeTeam and awayTeam are required");
    }

    if (request.P1 <= 0 || request.X <= 0 || request.P2 <= 0)
    {
        return Results.BadRequest("Odds must be greater than 0");
    }

    var (match, error) = await service.AddUserMatchAsync(
        userId,
        request.League.Trim(),
        request.Time.Trim(),
        request.HomeTeam.Trim(),
        request.AwayTeam.Trim(),
        request.P1,
        request.X,
        request.P2);

    if (match == null)
    {
        return Results.BadRequest(error ?? "Could not create match");
    }

    return Results.Ok(new
    {
        match.Id,
        match.League,
        match.Time,
        HomeTeam = match.HomeTeam.Name,
        AwayTeam = match.AwayTeam.Name,
        Odds = new { match.Odds.P1, match.Odds.X, match.Odds.P2 }
    });
});

app.MapGet(
    AppCommon.Routes.UnderstatXg,
    async (
        string homeTeam,
        string awayTeam,
        double? p1,
        double? x,
        double? p2,
        UnderstatXgService service,
        CancellationToken cancellationToken) =>
    {
        if (string.IsNullOrWhiteSpace(homeTeam) || string.IsNullOrWhiteSpace(awayTeam))
        {
            return Results.BadRequest("homeTeam and awayTeam are required");
        }

        var xg = await service.GetExpectedGoalsAsync(homeTeam, awayTeam, p1, x, p2, cancellationToken);
        return Results.Ok(xg);
    }
);

// Users API
app.MapPost(AppCommon.Routes.AuthRegister, async (RegisterRequest request, UserService service) =>
{
    var user = await service.RegisterAsync(request.Username, request.Email, request.Password);
    if (user == null) return Results.BadRequest(AppCommon.Errors.UserExists);
    
    return Results.Ok(new { user.Id, user.Username, user.Email, user.Role });
});

app.MapPost(AppCommon.Routes.AuthLogin, async (LoginRequest request, UserService service) =>
{
    var user = await service.LoginAsync(request.UsernameOrEmail, request.Password);
    if (user == null) return Results.Unauthorized();
    
    return Results.Ok(new { user.Id, user.Username, user.Email, user.Role });
});

app.MapGet(AppCommon.Routes.UserById, async (int id, UserService service) =>
{
    var user = await service.GetByIdAsync(id);
    if (user == null) return Results.NotFound();
    
    return Results.Ok(new 
    { 
        user.Id, 
        user.Username, 
        user.Email, 
        user.Role,
        user.LastLogin,
        Favorites = user.Favorites.Select(f => new
        {
            f.MatchId,
            f.AddedAt,
            Match = new
            {
                f.Match.Id,
                f.Match.League,
                f.Match.Time,
                HomeTeam = f.Match.HomeTeam.Name,
                AwayTeam = f.Match.AwayTeam.Name,
                Odds = f.Match.Odds
            }
        })
    });
});

app.MapGet("/api/excel", async ([FromServices] ExcelService service) =>
{
    var fileBytes = await service.GetExcelAsync();
    return Results.File(
        fileBytes,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        $"Users_{DateTime.Now:yyyyMMddHHmmss}.xlsx");
});

app.MapGet(AppCommon.Routes.UserCreatedMatches, async (int userId, OddsService service) =>
{
    var matches = await service.GetUserCreatedMatchesByUserAsync(userId);

    return Results.Ok(matches.Select(match => new
    {
        match.Id,
        match.League,
        match.Time,
        HomeTeam = new
        {
            match.HomeTeam.Id,
            match.HomeTeam.Name,
            match.HomeTeam.Logo,
            match.HomeTeam.Form
        },
        AwayTeam = new
        {
            match.AwayTeam.Id,
            match.AwayTeam.Name,
            match.AwayTeam.Logo,
            match.AwayTeam.Form
        },
        Odds = new
        {
            match.Odds.Id,
            match.Odds.MatchId,
            match.Odds.P1,
            match.Odds.X,
            match.Odds.P2,
            match.Odds.LastUpdated
        },
        match.IsLive,
        match.Score
    }));
});

app.MapPut(AppCommon.Routes.UserCreatedMatchById, async (
    int userId,
    int matchId,
    CreateUserMatchRequest request,
    OddsService service) =>
{
    if (string.IsNullOrWhiteSpace(request.League)
        || string.IsNullOrWhiteSpace(request.Time)
        || string.IsNullOrWhiteSpace(request.HomeTeam)
        || string.IsNullOrWhiteSpace(request.AwayTeam))
    {
        return Results.BadRequest("League, time, homeTeam and awayTeam are required");
    }

    if (request.P1 <= 0 || request.X <= 0 || request.P2 <= 0)
    {
        return Results.BadRequest("Odds must be greater than 0");
    }

    var (match, error) = await service.UpdateUserMatchAsync(
        userId,
        matchId,
        request.League.Trim(),
        request.Time.Trim(),
        request.HomeTeam.Trim(),
        request.AwayTeam.Trim(),
        request.P1,
        request.X,
        request.P2);

    if (match == null)
    {
        return Results.BadRequest(error ?? "Could not update match");
    }

    return Results.Ok(new
    {
        match.Id,
        match.League,
        match.Time,
        HomeTeam = new { match.HomeTeam.Id, match.HomeTeam.Name, match.HomeTeam.Logo, match.HomeTeam.Form },
        AwayTeam = new { match.AwayTeam.Id, match.AwayTeam.Name, match.AwayTeam.Logo, match.AwayTeam.Form },
        Odds = new { match.Odds.Id, match.Odds.MatchId, match.Odds.P1, match.Odds.X, match.Odds.P2, match.Odds.LastUpdated },
        match.IsLive,
        match.Score,
        match.CreatedByUserId
    });
});

app.MapPost(AppCommon.Routes.UserFavorites, async (int userId, int matchId, UserService service) =>
{
    var result = await service.AddToFavoritesAsync(userId, matchId);

    return result switch
    {
        AddFavoriteResult.Added => Results.Ok(),
        AddFavoriteResult.AlreadyExists => Results.BadRequest(AppCommon.Errors.AlreadyInFavorites),
        AddFavoriteResult.UserNotFound => Results.NotFound("User not found"),
        AddFavoriteResult.MatchNotFound => Results.NotFound("Match not found"),
        _ => Results.BadRequest("Could not add to favorites")
    };
});

app.MapDelete(AppCommon.Routes.UserFavorites, async (int userId, int matchId, UserService service) =>
{
    var success = await service.RemoveFromFavoritesAsync(userId, matchId);
    if (!success) return Results.NotFound(AppCommon.Errors.FavoriteNotFound);
    return Results.Ok();
});

app.MapPut(AppCommon.Routes.UserById, async (int id, UpdateUserRequest request, UserService service) =>
{
    var success = await service.UpdateUserAsync(id, request);
    if (!success) return Results.NotFound();
    return Results.Ok(new { request.Username, request.Email });
});

app.Run();

public record UpdateUserRequest(string Username, string Email, string? Password);
public record CreateUserMatchRequest(string League, string Time, string HomeTeam, string AwayTeam, double P1, double X, double P2);

record CalculateRequest(double BookmakerOdd, double YourProbability);
record RegisterRequest(string Username, string Email, string Password);
record LoginRequest(string UsernameOrEmail, string Password);

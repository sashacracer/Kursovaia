using Kursovaia.Api.Common;
using Kursovaia.Api.Data;
using Kursovaia.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy(AppCommon.CorsPolicyName, policy =>
    {
        policy.WithOrigins(AppCommon.FrontendOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

builder.Services.AddDbContext<KursovaiaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddScoped<OddsService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddHttpClient<SofascoreMatchesService>();
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

app.MapPost(AppCommon.Routes.UserFavorites, async (int userId, int matchId, UserService service) =>
{
    var success = await service.AddToFavoritesAsync(userId, matchId);
    if (!success) return Results.BadRequest(AppCommon.Errors.AlreadyInFavorites);
    return Results.Ok();
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

record CalculateRequest(double BookmakerOdd, double YourProbability);
record RegisterRequest(string Username, string Email, string Password);
record LoginRequest(string UsernameOrEmail, string Password);

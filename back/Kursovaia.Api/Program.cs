using Kursovaia.Api.Data;
using Kursovaia.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// CORS для фронта
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://127.0.0.1:5500", "http://localhost:5500")
            .AllowAnyMethod()
            .AllowAnyHeader();
    });
});

// База данных
builder.Services.AddDbContext<KursovaiaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Сервисы
builder.Services.AddScoped<OddsService>();
builder.Services.AddHostedService<OddsBackgroundService>();

var app = builder.Build();

app.UseCors("AllowFrontend");

// API endpoints
app.MapGet("/api/matches", async (OddsService service) => 
    Results.Ok(await service.GetMatchesAsync()));

app.MapPost("/api/calculate", (CalculateRequest request, OddsService service) =>
{
    var result = service.CalculateValue(request.BookmakerOdd, request.YourProbability);
    return Results.Ok(result);
});

app.Run();

record CalculateRequest(double BookmakerOdd, double YourProbability);
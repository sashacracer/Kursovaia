using Kursovaia.Api.Services;

namespace Kursovaia.Api.Services;

public class OddsBackgroundService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<OddsBackgroundService> _logger;

    public OddsBackgroundService(IServiceProvider services, ILogger<OddsBackgroundService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _services.CreateScope();
            var oddsService = scope.ServiceProvider.GetRequiredService<OddsService>();
            
            await oddsService.SimulateOddsChangesAsync();
            _logger.LogInformation("Odds updated at {Time}", DateTime.Now);
            
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        }
    }
}
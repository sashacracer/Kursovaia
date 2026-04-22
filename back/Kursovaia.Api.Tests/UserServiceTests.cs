using Kursovaia.Api.Data;
using Kursovaia.Api.Models;
using Kursovaia.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Kursovaia.Api.Tests;

public class UserServiceTests
{
    private static ServiceProvider BuildProvider(string dbName)
    {
        var services = new ServiceCollection();

        services.AddDbContext<KursovaiaDbContext>(options =>
            options.UseInMemoryDatabase(dbName));

        services.AddScoped<UserService>();

        return services.BuildServiceProvider();
    }

    [Fact]
    public async Task RegisterAsync_CreatesUser_WhenDataIsUnique()
    {
        using var provider = BuildProvider(nameof(RegisterAsync_CreatesUser_WhenDataIsUnique));
        var service = provider.GetRequiredService<UserService>();

        var result = await service.RegisterAsync("test_user", "test@mail.com", "123456");

        Assert.NotNull(result);
        Assert.Equal("test_user", result.Username);
        Assert.Equal("test@mail.com", result.Email);
        Assert.Equal("User", result.Role);
    }

    [Fact]
    public async Task RegisterAsync_ReturnsNull_WhenUserExists()
    {
        using var provider = BuildProvider(nameof(RegisterAsync_ReturnsNull_WhenUserExists));
        var service = provider.GetRequiredService<UserService>();

        await service.RegisterAsync("duplicate", "dup@mail.com", "123456");
        var duplicate = await service.RegisterAsync("duplicate", "other@mail.com", "123456");

        Assert.Null(duplicate);
    }

    [Fact]
    public async Task LoginAsync_ReturnsUser_WhenCredentialsAreValid()
    {
        using var provider = BuildProvider(nameof(LoginAsync_ReturnsUser_WhenCredentialsAreValid));
        var service = provider.GetRequiredService<UserService>();

        await service.RegisterAsync("login_user", "login@mail.com", "123456");
        var loggedIn = await service.LoginAsync("login_user", "123456");

        Assert.NotNull(loggedIn);
        Assert.Equal("login_user", loggedIn.Username);
        Assert.NotNull(loggedIn.LastLogin);
    }

    [Fact]
    public async Task AddToFavoritesAsync_ReturnsUserNotFound_WhenUserDoesNotExist()
    {
        using var provider = BuildProvider(nameof(AddToFavoritesAsync_ReturnsUserNotFound_WhenUserDoesNotExist));
        var service = provider.GetRequiredService<UserService>();

        var result = await service.AddToFavoritesAsync(999, 1);

        Assert.Equal(AddFavoriteResult.UserNotFound, result);
    }

    [Fact]
    public async Task AddToFavoritesAsync_ReturnsMatchNotFound_WhenMatchDoesNotExist()
    {
        using var provider = BuildProvider(nameof(AddToFavoritesAsync_ReturnsMatchNotFound_WhenMatchDoesNotExist));
        var service = provider.GetRequiredService<UserService>();

        var user = await service.RegisterAsync("fav_user", "fav@mail.com", "123456");
        var result = await service.AddToFavoritesAsync(user!.Id, 777);

        Assert.Equal(AddFavoriteResult.MatchNotFound, result);
    }

    [Fact]
    public async Task AddToFavoritesAsync_ReturnsAdded_AndThenAlreadyExists_WhenCalledTwice()
    {
        using var provider = BuildProvider(nameof(AddToFavoritesAsync_ReturnsAdded_AndThenAlreadyExists_WhenCalledTwice));

        var context = provider.GetRequiredService<KursovaiaDbContext>();
        var service = provider.GetRequiredService<UserService>();

        var user = await service.RegisterAsync("fav_user_2", "fav2@mail.com", "123456");

        var home = new Team { Name = "Home", Logo = "H", Form = "-" };
        var away = new Team { Name = "Away", Logo = "A", Form = "-" };

        var match = new Match
        {
            League = "Test League",
            Time = "Today 21:00",
            HomeTeam = home,
            AwayTeam = away,
            Odds = new MatchOdds { P1 = 2.0, X = 3.0, P2 = 4.0 },
            IsLive = false
        };

        context.Matches.Add(match);
        await context.SaveChangesAsync();

        var first = await service.AddToFavoritesAsync(user!.Id, match.Id);
        var second = await service.AddToFavoritesAsync(user.Id, match.Id);

        Assert.Equal(AddFavoriteResult.Added, first);
        Assert.Equal(AddFavoriteResult.AlreadyExists, second);

        var count = await context.UserFavorites.CountAsync(f => f.UserId == user.Id && f.MatchId == match.Id);
        Assert.Equal(1, count);
    }
}

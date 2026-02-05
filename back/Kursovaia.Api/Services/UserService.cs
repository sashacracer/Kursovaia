using Kursovaia.Api.Data;
using Kursovaia.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;

namespace Kursovaia.Api.Services;

public class UserService
{
    private readonly IServiceProvider _services;

    public UserService(IServiceProvider services)
    {
        _services = services;
    }

    private string HashPassword(string password)
    {
        using var sha256 = SHA256.Create();
        var bytes = Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    private bool VerifyPassword(string password, string hash)
    {
        return HashPassword(password) == hash;
    }

    public async Task<User?> RegisterAsync(string username, string email, string password)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        if (await context.Users.AnyAsync(u => u.Username == username || u.Email == email))
        {
            return null;
        }

        var user = new User
        {
            Username = username,
            Email = email,
            PasswordHash = HashPassword(password)
        };

        context.Users.Add(user);
        await context.SaveChangesAsync();

        return user;
    }

    public async Task<User?> LoginAsync(string usernameOrEmail, string password)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        var user = await context.Users
            .FirstOrDefaultAsync(u => u.Username == usernameOrEmail || u.Email == usernameOrEmail);

        if (user == null || !VerifyPassword(password, user.PasswordHash))
        {
            return null;
        }

        user.LastLogin = DateTime.Now;
        await context.SaveChangesAsync();

        return user;
    }

    public async Task<User?> GetByIdAsync(int id)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        return await context.Users
            .Include(u => u.Favorites)
            .ThenInclude(f => f.Match)
            .ThenInclude(m => m.HomeTeam)
            .Include(u => u.Favorites)
            .ThenInclude(f => f.Match)
            .ThenInclude(m => m.AwayTeam)
            .Include(u => u.Favorites)
            .ThenInclude(f => f.Match)
            .ThenInclude(m => m.Odds)
            .FirstOrDefaultAsync(u => u.Id == id);
    }

    public async Task<bool> AddToFavoritesAsync(int userId, int matchId)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        var existing = await context.UserFavorites
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.MatchId == matchId);

        if (existing != null) return false;

        var favorite = new UserFavorite
        {
            UserId = userId,
            MatchId = matchId
        };

        context.UserFavorites.Add(favorite);
        await context.SaveChangesAsync();
        return true;
    }

    public async Task<bool> RemoveFromFavoritesAsync(int userId, int matchId)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        var favorite = await context.UserFavorites
            .FirstOrDefaultAsync(uf => uf.UserId == userId && uf.MatchId == matchId);

        if (favorite == null) return false;

        context.UserFavorites.Remove(favorite);
        await context.SaveChangesAsync();
        return true;
    }
    public async Task<bool> UpdateUserAsync(int id, UpdateUserRequest request)
    {
        using var scope = _services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<KursovaiaDbContext>();

        var user = await context.Users.FindAsync(id);
        if (user == null) return false;

        // Проверяем уникальность username и email
        var existing = await context.Users
            .FirstOrDefaultAsync(u => (u.Username == request.Username || u.Email == request.Email) && u.Id != id);
    
        if (existing != null) return false;

        user.Username = request.Username;
        user.Email = request.Email;
    
        if (!string.IsNullOrEmpty(request.Password))
        {
            user.PasswordHash = HashPassword(request.Password);
        }

        await context.SaveChangesAsync();
        return true;
    }
}
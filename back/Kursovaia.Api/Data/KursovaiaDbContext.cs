using Microsoft.EntityFrameworkCore;
using Kursovaia.Api.Models;

namespace Kursovaia.Api.Data;

public class KursovaiaDbContext : DbContext
{
    public KursovaiaDbContext(DbContextOptions<KursovaiaDbContext> options) 
        : base(options)
    {
    }

    public DbSet<Match> Matches { get; set; }
    public DbSet<Team> Teams { get; set; }
    public DbSet<MatchOdds> MatchOdds { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<UserFavorite> UserFavorites { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Match>()
            .HasOne(m => m.HomeTeam)
            .WithMany()
            .HasForeignKey(m => m.HomeTeamId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Match>()
            .HasOne(m => m.AwayTeam)
            .WithMany()
            .HasForeignKey(m => m.AwayTeamId)
            .OnDelete(DeleteBehavior.NoAction);

        modelBuilder.Entity<Match>()
            .HasOne(m => m.Odds)
            .WithOne()
            .HasForeignKey<MatchOdds>(o => o.MatchId);

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<UserFavorite>()
            .HasIndex(uf => new { uf.UserId, uf.MatchId })
            .IsUnique();
    }
}
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
    }
}
namespace Kursovaia.Api.Models;

public class Match
{
    public int Id { get; set; }
    public string League { get; set; } = "";
    public string Time { get; set; } = "";
    
    public int HomeTeamId { get; set; }
    public Team HomeTeam { get; set; } = null!;
    
    public int AwayTeamId { get; set; }
    public Team AwayTeam { get; set; } = null!;
    
    public MatchOdds Odds { get; set; } = null!;
    public bool IsLive { get; set; }
    public string? Score { get; set; }
}
namespace Kursovaia.Api.Models;

public class MatchOdds
{
    public int Id { get; set; }
    public int MatchId { get; set; }
    public double P1 { get; set; }
    public double X { get; set; }
    public double P2 { get; set; }
    public DateTime LastUpdated { get; set; }
}
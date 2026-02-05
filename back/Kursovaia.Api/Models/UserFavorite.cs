namespace Kursovaia.Api.Models;

public class UserFavorite
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public int MatchId { get; set; }
    public Match Match { get; set; } = null!;
    public DateTime AddedAt { get; set; } = DateTime.Now;
}
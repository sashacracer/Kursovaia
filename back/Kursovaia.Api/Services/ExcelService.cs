using ClosedXML.Excel;
using Kursovaia.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Kursovaia.Api.Services;

public class ExcelService
{
    private readonly KursovaiaDbContext _context;

    public ExcelService(KursovaiaDbContext context)
    {
        _context = context;
    }

    // Возвращает byte[] с XLSX-файлом, содержащим несколько листов с данными.
    public async Task<byte[]> GetExcelAsync()
    {
        var users = await _context.Users
            .AsNoTracking()
            .OrderBy(u => u.Id)
            .ToListAsync();

        var matches = await _context.Matches
            .AsNoTracking()
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Include(m => m.Odds)
            .OrderBy(m => m.Id)
            .ToListAsync();

        using var workbook = new XLWorkbook();

        var userSheet = workbook.Worksheets.Add("Users");
        userSheet.Cell(1, 1).Value = "Id";
        userSheet.Cell(1, 2).Value = "Username";
        userSheet.Cell(1, 3).Value = "Email";
        userSheet.Cell(1, 4).Value = "Role";
        userSheet.Cell(1, 5).Value = "CreatedAt";
        userSheet.Cell(1, 6).Value = "LastLogin";

        for (var i = 0; i < users.Count; i++)
        {
            var row = i + 2;
            var user = users[i];

            userSheet.Cell(row, 1).Value = user.Id;
            userSheet.Cell(row, 2).Value = user.Username;
            userSheet.Cell(row, 3).Value = user.Email;
            userSheet.Cell(row, 4).Value = user.Role;
            userSheet.Cell(row, 5).Value = user.CreatedAt;
            userSheet.Cell(row, 6).Value = user.LastLogin;
        }

        var matchSheet = workbook.Worksheets.Add("Matches");
        matchSheet.Cell(1, 1).Value = "Id";
        matchSheet.Cell(1, 2).Value = "League";
        matchSheet.Cell(1, 3).Value = "Time";
        matchSheet.Cell(1, 4).Value = "HomeTeam";
        matchSheet.Cell(1, 5).Value = "AwayTeam";
        matchSheet.Cell(1, 6).Value = "P1";
        matchSheet.Cell(1, 7).Value = "X";
        matchSheet.Cell(1, 8).Value = "P2";
        matchSheet.Cell(1, 9).Value = "IsLive";
        matchSheet.Cell(1, 10).Value = "Score";
        matchSheet.Cell(1, 11).Value = "IsUserCreated";
        matchSheet.Cell(1, 12).Value = "CreatedByUserId";

        for (var i = 0; i < matches.Count; i++)
        {
            var row = i + 2;
            var match = matches[i];

            matchSheet.Cell(row, 1).Value = match.Id;
            matchSheet.Cell(row, 2).Value = match.League;
            matchSheet.Cell(row, 3).Value = match.Time;
            matchSheet.Cell(row, 4).Value = match.HomeTeam.Name;
            matchSheet.Cell(row, 5).Value = match.AwayTeam.Name;
            matchSheet.Cell(row, 6).Value = match.Odds.P1;
            matchSheet.Cell(row, 7).Value = match.Odds.X;
            matchSheet.Cell(row, 8).Value = match.Odds.P2;
            matchSheet.Cell(row, 9).Value = match.IsLive;
            matchSheet.Cell(row, 10).Value = match.Score ?? string.Empty;
            matchSheet.Cell(row, 11).Value = match.IsUserCreated;
            matchSheet.Cell(row, 12).Value = match.CreatedByUserId;
        }

        userSheet.Columns().AdjustToContents();
        matchSheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);

        return stream.ToArray();
    }
}

using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kursovaia.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIsUserCreatedToMatches : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsUserCreated",
                table: "Matches",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsUserCreated",
                table: "Matches");
        }
    }
}

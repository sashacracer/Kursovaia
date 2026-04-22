using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Kursovaia.Api.Migrations
{
    public partial class AddCreatedByUserIdToMatches : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "Matches",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Matches_CreatedByUserId",
                table: "Matches",
                column: "CreatedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Matches_Users_CreatedByUserId",
                table: "Matches",
                column: "CreatedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Matches_Users_CreatedByUserId",
                table: "Matches");

            migrationBuilder.DropIndex(
                name: "IX_Matches_CreatedByUserId",
                table: "Matches");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Matches");
        }
    }
}

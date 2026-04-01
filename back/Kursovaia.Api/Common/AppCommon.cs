namespace Kursovaia.Api.Common;

public static class AppCommon
{
    public const string CorsPolicyName = "AllowFrontend";

    public static readonly string[] FrontendOrigins =
    {
        "http://localhost:3000",
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    };

    public static class Routes
    {
        public const string Matches = "/api/matches";
        public const string Calculate = "/api/calculate";
        public const string AuthRegister = "/api/auth/register";
        public const string AuthLogin = "/api/auth/login";
        public const string UserById = "/api/users/{id}";
        public const string UserFavorites = "/api/users/{userId}/favorites/{matchId}";
    }

    public static class Errors
    {
        public const string UserExists = "Username or email already exists";
        public const string AlreadyInFavorites = "Already in favorites";
        public const string FavoriteNotFound = "Favorite not found";
    }
}

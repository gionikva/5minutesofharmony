from django.contrib.auth import authenticate
from rest_framework.authtoken.models import Token
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Authenticate a user and return a token + basic user info.

    Expected POST body: {"username": "...", "password": "..."}
    Response (200): {"token": "...", "username": "...", "email": "..."}
    Response (400): {"detail": "Invalid credentials"}
    """
    username = request.data.get("username")
    password = request.data.get("password")

    if not username or not password:
        return Response(
            {"detail": "username and password required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=username, password=password)
    if user is None:
        return Response(
            {"detail": "Invalid credentials"}, status=status.HTTP_400_BAD_REQUEST
        )

    token, _ = Token.objects.get_or_create(user=user)
    return Response(
        {"token": token.key, "username": user.username, "email": user.email}
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def users_list(request):
    """Return a list of users (username and email). Requires authentication."""
    User = get_user_model()
    qs = User.objects.all().values("username", "email")
    return Response(list(qs))

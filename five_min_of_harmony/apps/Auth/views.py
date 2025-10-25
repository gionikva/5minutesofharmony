from django.contrib.auth import authenticate, login
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Authenticate a user and create a session (cookie).

    Expected POST body: {"username": "...", "password": "..."}
    Response (200): {"username": "...", "email": "..."}
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

    # Log the user in to create a session cookie
    login(request, user)
    return Response({"username": user.username, "email": user.email})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def users_list(request):
    """Return a list of users (username and email). Requires authentication."""
    User = get_user_model()
    qs = User.objects.all().values("username", "email")
    return Response(list(qs))


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register_view(request):
    """Create a user with username and password.

    Expected POST body: {"username": "...", "password": "...", "email": "..." (optional)}
    Returns 201 with token and user info on success.
    """
    username = request.data.get("username")
    password = request.data.get("password")
    email = request.data.get("email", "")

    if not username or not password:
        return Response(
            {"detail": "username and password required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    User = get_user_model()
    if User.objects.filter(username=username).exists():
        return Response(
            {"detail": "username already exists"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(username=username, email=email, password=password)
    # Log the newly created user in (session cookie)
    login(request, user)
    return Response(
        {"username": user.username, "email": user.email},
        status=status.HTTP_201_CREATED,
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_profile(request):
    """Return username, email, and time until next action (seconds).

    Response example (200):
    {"username": "...", "email": "...", "time_until_next_action": 0}
    """
    user = request.user
    profile = getattr(user, "profile", None)
    # default tick seconds
    tick = getattr(settings, "ACTION_TICK_SECONDS", 300)

    if profile is None or profile.last_used is None:
        remaining = 0
    else:
        elapsed = (timezone.now() - profile.last_used).total_seconds()
        remaining = max(0, int(tick - elapsed))

    return Response(
        {
            "username": user.username,
            "email": user.email,
            "time_until_next_action": remaining,
        }
    )


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def has_action(request):
    """Return whether the authenticated user currently has an action available.

    Response example (200): {"has_action": true}
    """
    user = request.user
    profile = getattr(user, "profile", None)
    has = True
    if profile is None:
        has = True
    else:
        has = bool(profile.has_action)

    return Response({"has_action": has})

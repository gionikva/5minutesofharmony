from django.contrib.auth import authenticate, login
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from .models import Profile
from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token


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

    # create a session (cookie-based) for the authenticated user
    login(request, user)
    return Response({"username": user.username, "email": user.email})


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def users_list(request):
    """Return a list of users (username and email). Requires authentication."""
    User = get_user_model()
    users = []
    for u in User.objects.all():
        profile = getattr(u, "profile", None)
        has_action = True
        if profile is not None:
            has_action = profile.has_action
        users.append(
            {"username": u.username, "email": u.email, "has_action": has_action}
        )
    return Response(users)


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
    # ensure profile exists (signal may create it; do defensively)
    Profile.objects.get_or_create(user=user)
    # log the user in (session cookie)
    login(request, user)
    return Response(
        {"username": user.username, "email": user.email}, status=status.HTTP_201_CREATED
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def use_action(request):
    """Consume the user's action if available.

    If available, set last_used to now and return success. Otherwise return 400.
    """
    user = request.user
    profile, _ = Profile.objects.get_or_create(user=user)
    if not profile.has_action:
        return Response(
            {"detail": "action not available"}, status=status.HTTP_400_BAD_REQUEST
        )
    profile.last_used = timezone.now()
    profile.save()
    return Response(
        {
            "detail": "action consumed",
            "next_available_in_seconds": int(
                getattr(settings, "ACTION_TICK_SECONDS", 300)
            ),
        }
    )


# Provide a CSRF-friendly endpoint. Hitting this (GET) will set the csrftoken cookie
# and return the current token in JSON so SPA frontends can bootstrap and include
# the token in subsequent unsafe requests (POST/PUT/DELETE).
@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def csrf_token_view(request):
    token = get_token(request)
    return Response({"csrfToken": token})

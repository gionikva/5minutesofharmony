from django.contrib.auth import authenticate, login
from rest_framework import status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
from .utils import time_until_next_action, user_has_action
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from .models import Profile


@ensure_csrf_cookie
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


@ensure_csrf_cookie
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
    remaining = time_until_next_action(user)

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
    return Response({"has_action": user_has_action(user)})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def use_action(request):
    """Consume the user's action if available (requires session cookie).

    This endpoint requires the user to be authenticated via the Django
    session cookie. Clients should include the `X-CSRFToken` header when
    making POST requests. If the user has an available action, `last_used`
    is updated and a success response is returned; otherwise a 400 is
    returned indicating the action is on cooldown.
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
def csrf_view(request):
    """Return a CSRF token and ensure the CSRF cookie is set.

    This uses Django's ensure_csrf_cookie decorator so cookie attributes
    (samesite, secure, domain) follow settings automatically.
    """
    token = get_token(request)
    return Response({"csrfToken": token})

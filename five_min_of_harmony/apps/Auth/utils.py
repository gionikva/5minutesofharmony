from django.conf import settings
from django.utils import timezone
from .models import Profile


def _safe_get_profile(user):
    """Return user's Profile or None if it doesn't exist.

    Accessing `user.profile` raises Profile.DoesNotExist when missing, so
    we catch that and return None to make callers robust.
    """
    try:
        return user.profile
    except Profile.DoesNotExist:
        return None


def time_until_next_action(user) -> int:
    """Return number of seconds until the user can perform the next action.

    Returns 0 when action is available now. If the user's Profile or
    `last_used` is missing, the action is considered available.
    """
    profile = _safe_get_profile(user)
    tick = getattr(settings, "ACTION_TICK_SECONDS", 300)

    if profile is None or profile.last_used is None:
        return 0

    elapsed = (timezone.now() - profile.last_used).total_seconds()
    remaining = max(0, int(tick - elapsed))
    return remaining


def user_has_action(user) -> bool:
    """Return True when the user currently has an action available.

    This is a convenience wrapper around `time_until_next_action`.
    """
    return time_until_next_action(user) == 0

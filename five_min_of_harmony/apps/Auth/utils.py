from django.conf import settings
from django.utils import timezone


def time_until_next_action(user) -> int:
    """Return number of seconds until the user can perform the next action.

    Returns 0 when action is available now. Safe to call with any user-like
    object; if the `profile` relation or `last_used` is missing it treats
    the action as available.
    """
    profile = getattr(user, "profile", None)
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

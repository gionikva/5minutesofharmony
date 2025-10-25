from django.db import models
from django.conf import settings
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings


class Profile(models.Model):
    """Per-user profile storing action cooldown state.

    We store the timestamp when the action was last used (`last_used`).
    The computed `has_action` property returns True when the time since
    `last_used` is greater than or equal to the configured tick interval.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile"
    )
    last_used = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Profile({self.user.username})"

    @property
    def has_action(self) -> bool:
        tick = getattr(settings, "ACTION_TICK_SECONDS", 300)
        if self.last_used is None:
            return True
        elapsed = (timezone.now() - self.last_used).total_seconds()
        return elapsed >= tick


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile_for_user(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

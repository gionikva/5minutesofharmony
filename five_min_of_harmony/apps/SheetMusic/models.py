from django.db import models

# Create your models here.
class SheetMusic(models.Model):
    measure = models.PositiveIntegerField()
    value = models.PositiveIntegerField()
    pitch = models.CharField()
    flourish = models.CharField()
    
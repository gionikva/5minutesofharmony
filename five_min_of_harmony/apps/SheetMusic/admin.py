from django.contrib import admin
from .models import Note

# Register your models here.
@admin.register(Note)
class Note(admin.ModelAdmin):
    list_display = ('measure', 'duration', 'pitch','initialized','order')
    list_filter = ('measure',)


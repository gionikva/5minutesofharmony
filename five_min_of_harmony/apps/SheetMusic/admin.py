from django.contrib import admin
from .models import SheetMusic

# Register your models here.
@admin.register(SheetMusic)
class SheetMusicAdmin(admin.ModelAdmin):
    list_display = ('measure', 'value', 'pitch', 'flourish')
    list_filter = ('measure',)


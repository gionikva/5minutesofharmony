from .constants import * 

def validate_change(request):
    duration = request.data.get('duration')
    pitch = request.data.get('pitch')
    
    if duration not in DURATIONS:
        return (False, "Value out of bounds.")


    if pitch not in TREBLE_CLEF_NOTES_MIDI:
        return (False, "Selected pitch not recognized.")


    return (True, "")
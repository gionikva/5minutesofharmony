from .constants import * 

def validate_change(request):
    measure = request.data.get('measure')
    duration = request.data.get('duration')
    pitch = request.data.get('pitch')
    flourish = request.data.get('flourish')

    if measure < 0 or measure > TOTAL_MEASURES:
        return (False, "Measure out of bounds.")
    
    if duration not in DURATIONS:
        return (False, "Value out of bounds.")


    if pitch not in TREBLE_CLEF_NOTES_MIDI:
        return (False, "Selected pitch not recognized.")


    return (True, "")
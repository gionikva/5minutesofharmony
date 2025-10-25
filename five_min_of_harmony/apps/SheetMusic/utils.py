from .constants import * 

def validate_change(request):
    measure = request.data.get('measure')
    value = request.data.get('value')
    pitch = request.data.get('pitch')
    flourish = request.data.get('flourish')

    if measure < 0 or measure > TOTAL_MEASURES:
        return (False, "Measure out of bounds.")
    
    if value not in VALUES:
        return (False, "Value out of bounds.")


    if pitch not in PITCHES:
        return (False, "Selected pitch not recognized.")

    if flourish not in FLOURISHES:
        return (False, "Selected flourish not recognized.")

    return (True, "")
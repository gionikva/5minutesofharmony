from django.urls import path
from .views import login_view, users_list, register_view, use_action, csrf_token_view

urlpatterns = [
    path("login/", login_view, name="api_login"),
    path("register/", register_view, name="api_register"),
    path("csrf/", csrf_token_view, name="api_csrf"),
    path("use_action/", use_action, name="api_use_action"),
    path("users/", users_list, name="api_users"),
]

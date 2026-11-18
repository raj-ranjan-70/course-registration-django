from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    StudentLoginView,
    StudentRegisterView,
    FacultyLoginView,
    CurrentUserView,
    StudentProfileUpdateView,
    LogoutView,
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='token-login'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('student-login/', StudentLoginView.as_view(), name='student-login'),
    path('student-register/', StudentRegisterView.as_view(), name='student-register'),
    path('faculty-login/', FacultyLoginView.as_view(), name='faculty-login'),
    path('me/', CurrentUserView.as_view(), name='current-user'),
    path('profile-update/', StudentProfileUpdateView.as_view(), name='student-profile-update'),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
]

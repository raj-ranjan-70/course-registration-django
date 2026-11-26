from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView,
    StudentLoginView,
    StudentRegisterView,
    FacultyLoginView,
    CurrentUserView,
    StudentProfileUpdateView,
    CompleteProfileView,
    GoogleLoginView,
    GoogleCallbackView,
    GitHubLoginView,
    GitHubCallbackView,
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
    path('complete-profile/', CompleteProfileView.as_view(), name='complete-profile'),
    path('complete-profile', CompleteProfileView.as_view()),
    path('google/login/', GoogleLoginView.as_view(), name='google-login'),
    path('google/login', GoogleLoginView.as_view()),
    path('google/callback/', GoogleCallbackView.as_view(), name='google-callback'),
    path('google/callback', GoogleCallbackView.as_view()),
    path('github/login/', GitHubLoginView.as_view(), name='github-login'),
    path('github/login', GitHubLoginView.as_view()),
    path('github/callback/', GitHubCallbackView.as_view(), name='github-callback'),
    path('github/callback', GitHubCallbackView.as_view()),
    path('logout/', LogoutView.as_view(), name='auth-logout'),
]

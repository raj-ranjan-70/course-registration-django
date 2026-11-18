from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ElectivePreferenceViewSet, AllocationRunViewSet

router = DefaultRouter()
router.register(r'preferences', ElectivePreferenceViewSet, basename='preference')
router.register(r'allocations', AllocationRunViewSet, basename='allocation')

urlpatterns = [
    path('', include(router.urls)),
]

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ElectiveGroupViewSet,
    CourseViewSet,
    SectionViewSet,
    RegistrationViewSet,
    EligibilityViewSet,
    CartViewSet,
    StudentProfileView,
    StudentListView,
)

router = DefaultRouter()
router.register(r'electives', ElectiveGroupViewSet, basename='elective')
router.register(r'courses', CourseViewSet, basename='course')
router.register(r'sections', SectionViewSet, basename='section')
router.register(r'registrations', RegistrationViewSet, basename='registration')
router.register(r'eligibility', EligibilityViewSet, basename='eligibility')
router.register(r'cart', CartViewSet, basename='cart')

urlpatterns = [
    path('students/me/', StudentProfileView.as_view(), name='current-student'),
    path('students/', StudentListView.as_view(), name='student-list'),
    path('', include(router.urls)),
]

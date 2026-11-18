from rest_framework.permissions import BasePermission
from .models import User


class IsFacultyUser(BasePermission):
    """
    Allows access only to faculty members and administrators.
    """
    message = "Access forbidden: Faculty or Administrator credentials required."

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(
            user
            and user.is_authenticated
            and (user.role in [User.Role.FACULTY, User.Role.INSTRUCTOR, User.Role.ADMIN] or user.is_staff)
        )


class IsStudentUser(BasePermission):
    """
    Allows access only to students.
    """
    message = "Access forbidden: Student credentials required."

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        return bool(
            user
            and user.is_authenticated
            and user.role == User.Role.STUDENT
        )

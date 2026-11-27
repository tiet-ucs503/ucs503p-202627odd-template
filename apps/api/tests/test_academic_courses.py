import pytest

from app.academic import CATALOG_ROLES, CourseCreate, CourseUpdate, router


def test_course_inputs_normalize_and_reject_blank_values() -> None:
    course = CourseCreate(code=" cs101 ", title=" Intro to Computing ", required_equipment=["Projector", "Projector", ""])
    assert course.code == "CS101"
    assert course.title == "Intro to Computing"
    assert course.required_equipment == ["Projector"]

    with pytest.raises(ValueError):
        CourseCreate(code="  ", title="Valid title")
    with pytest.raises(ValueError):
        CourseUpdate(title=" ")


def test_catalog_routes_are_limited_to_admin_and_coordinator_roles() -> None:
    assert CATALOG_ROLES == ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR")
    assert {(route.path, tuple(sorted(route.methods or []))) for route in router.routes} == {
        ("/v1/academic/courses", ("GET",)),
        ("/v1/academic/courses", ("POST",)),
        ("/v1/academic/courses/{course_id}", ("PATCH",)),
        ("/v1/academic/courses/{course_id}", ("DELETE",)),
    }


def test_catalog_routes_require_authenticated_principal() -> None:
    for route in router.routes:
        assert route.dependant.dependencies
        assert any(dependency.call for dependency in route.dependant.dependencies)

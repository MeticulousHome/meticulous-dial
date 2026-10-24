# Qt Test unit tests of the C++ host. Build and run in the qt-dial-bookworm image:
#   cmake -S qt -B qt/build/tests -G Ninja -DDIAL_BUILD_TESTS=ON && cmake --build qt/build/tests
#   cd qt/build/tests && ctest --output-on-failure

# The Community uploader (src/community): the pure rules against the Rust tests and the cross-language
# vector of src-tauri/test-vectors, then the service, the HTTP client and the QML object against fakes.
foreach(test tst_community_model tst_community_service)
    add_executable(${test} ${test}.cpp mockhttpserver.h ${DIAL_COMMUNITY_SOURCES})
    target_include_directories(${test} PRIVATE ${PROJECT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR})
    target_compile_definitions(${test} PRIVATE
        DIAL_TEST_VECTORS_DIR="${PROJECT_SOURCE_DIR}/../src-tauri/test-vectors")
    target_link_libraries(${test} PRIVATE Qt6::Core Qt6::Network Qt6::Test PkgConfig::LIBCRYPTO)
    add_test(NAME ${test} COMMAND ${test})
    set_tests_properties(${test} PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen" TIMEOUT 120)
endforeach()

# Sentry (src/sentry): the pure rules (when it is on, message classification, the React sanitizer, rate
# limits, frame windows), then the reporter end to end in child processes against a local fake Sentry
# (fakesentry.h): events, breadcrumbs, caps, crashes sent on the next start, the offline cache. Only
# 127.0.0.1 is contacted.
set(dial_sentry_tests tst_sentry_filter)
if(DIAL_WITH_SENTRY)
    list(APPEND dial_sentry_tests tst_sentry_reporter)
endif()
foreach(test ${dial_sentry_tests})
    add_executable(${test} ${test}.cpp fakesentry.h ${DIAL_SENTRY_SOURCES})
    target_include_directories(${test} PRIVATE ${PROJECT_SOURCE_DIR}/src ${CMAKE_CURRENT_SOURCE_DIR})
    target_link_libraries(${test} PRIVATE Qt6::Core Qt6::Gui Qt6::Qml Qt6::Quick Qt6::Network Qt6::Test)
    dial_use_sentry(${test})
    add_test(NAME ${test} COMMAND ${test})
    set_tests_properties(${test} PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen" TIMEOUT 300)
endforeach()

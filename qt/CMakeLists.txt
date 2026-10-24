cmake_minimum_required(VERSION 3.21)
# C for sentry-native (and the assembly of breakpad and libunwind, enabled by their own CMake files).
project(meticulous-dial-qt VERSION 0.1.0 LANGUAGES C CXX)

# The Dial in Qt Quick. The QML lives in qml/ and is installed as files (not compiled into the binary):
# a QML change is a copy, and Qt keeps its own bytecode cache. See docs/qt-migration/DECISIONS.md.

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 6.4 REQUIRED COMPONENTS Core Gui Qml Quick WebSockets Network Concurrent)
find_package(PkgConfig REQUIRED)
pkg_check_modules(RLOTTIE REQUIRED IMPORTED_TARGET rlottie)
find_library(QRCODEGEN_LIB qrcodegencpp REQUIRED)
find_path(QRCODEGEN_INCLUDE qrcodegen.hpp PATH_SUFFIXES qrcodegencpp qrcodegen REQUIRED)
# Ed25519 for the Community uploader (src/community): OpenSSL's libcrypto (libssl-dev).
pkg_check_modules(LIBCRYPTO REQUIRED IMPORTED_TARGET libcrypto)

# The Community uploader (the Tauri Dial's community_upload.rs), shared with the unit tests.
set(DIAL_COMMUNITY_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/src/community/json.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/community/json.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/community/crypto.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/community/crypto.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/community/model.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/community/model.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/community/storage.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/community/storage.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/community/diagnostics.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/community/diagnostics.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/community/http.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/community/http.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/community/service.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/community/service.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/community.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/community.h
)

# Crash and error reports: sentry-native (MIT, not in bookworm), built from its pinned release with the
# project and linked statically. Backend breakpad (in process: no handler binary to ship), transport curl
# (bookworm's libcurl4). What is sent and when: docs/qt-migration/parity/sentry.md. Offline builds:
# -DFETCHCONTENT_SOURCE_DIR_SENTRY=<the release's sentry-native.zip, extracted>.
option(DIAL_WITH_SENTRY "Build with sentry-native (crash and error reports)" ON)
if(DIAL_WITH_SENTRY)
    include(FetchContent)
    set(SENTRY_BACKEND "breakpad" CACHE STRING "sentry-native crash backend")
    set(SENTRY_TRANSPORT "curl" CACHE STRING "sentry-native transport")
    set(SENTRY_BUILD_SHARED_LIBS OFF CACHE BOOL "")
    set(SENTRY_BUILD_TESTS OFF CACHE BOOL "")
    set(SENTRY_BUILD_EXAMPLES OFF CACHE BOOL "")
    set(SENTRY_ENABLE_INSTALL OFF CACHE BOOL "")
    set(SENTRY_INTEGRATION_QT OFF CACHE BOOL "")   # src/sentry has its own message hook (sanitized, rate-limited)
    FetchContent_Declare(sentry
        URL https://github.com/getsentry/sentry-native/releases/download/0.17.2/sentry-native.zip
        URL_HASH SHA256=00b4294299cc9d663fd5445dad3f7ba9c96087a7b00884bccd270edd96fb9f6e
        DOWNLOAD_EXTRACT_TIMESTAMP TRUE)
    FetchContent_MakeAvailable(sentry)
endif()

# Sentry's `dist`: <commits>.g<hash>, the package version's suffix. Configure time: build.sh runs cmake each build.
set(DIAL_QT_BUILD_ID "")
find_package(Git QUIET)
if(GIT_FOUND)
    execute_process(COMMAND ${GIT_EXECUTABLE} -C ${CMAKE_CURRENT_SOURCE_DIR}/.. rev-list --count HEAD
                    OUTPUT_VARIABLE _dial_commits OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_QUIET RESULT_VARIABLE _dial_rc1)
    execute_process(COMMAND ${GIT_EXECUTABLE} -C ${CMAKE_CURRENT_SOURCE_DIR}/.. rev-parse --short HEAD
                    OUTPUT_VARIABLE _dial_hash OUTPUT_STRIP_TRAILING_WHITESPACE ERROR_QUIET RESULT_VARIABLE _dial_rc2)
    if(_dial_rc1 EQUAL 0 AND _dial_rc2 EQUAL 0)
        set(DIAL_QT_BUILD_ID "${_dial_commits}.g${_dial_hash}")
    endif()
endif()
configure_file(src/sentry/dial_build_info.h.in ${CMAKE_CURRENT_BINARY_DIR}/generated/dial_build_info.h @ONLY)

# The Sentry module (src/sentry), shared with the unit tests.
set(DIAL_SENTRY_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/src/sentry/logfilter.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/sentry/logfilter.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/sentry/framemonitor.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/sentry/framemonitor.h
    ${CMAKE_CURRENT_SOURCE_DIR}/src/sentry/sentryreporter.cpp ${CMAKE_CURRENT_SOURCE_DIR}/src/sentry/sentryreporter.h
)
# Adds the Sentry module's dependencies to a target that compiles DIAL_SENTRY_SOURCES.
function(dial_use_sentry target)
    if(DIAL_WITH_SENTRY)
        target_link_libraries(${target} PRIVATE sentry::sentry)
        target_compile_definitions(${target} PRIVATE DIAL_HAVE_SENTRY=1)
    else()
        target_compile_definitions(${target} PRIVATE DIAL_HAVE_SENTRY=0)
    endif()
endfunction()

add_executable(meticulous-dial-qt
    src/main.cpp
    src/socketio.cpp src/socketio.h
    src/native.cpp src/native.h
    src/netguard.cpp src/netguard.h
    src/plotline.cpp src/plotline.h
    src/lottieitem.cpp src/lottieitem.h
    src/qrcodeitem.cpp src/qrcodeitem.h
    ${DIAL_COMMUNITY_SOURCES}
    ${DIAL_SENTRY_SOURCES}
)

target_compile_definitions(meticulous-dial-qt PRIVATE
    DIAL_QT_VERSION="${PROJECT_VERSION}"
    DIAL_QML_INSTALL_DIR="${CMAKE_INSTALL_PREFIX}/share/meticulous-dial-qt/qml")

target_link_libraries(meticulous-dial-qt PRIVATE
    Qt6::Core Qt6::Gui Qt6::Qml Qt6::Quick Qt6::WebSockets Qt6::Network Qt6::Concurrent PkgConfig::RLOTTIE ${QRCODEGEN_LIB} PkgConfig::LIBCRYPTO)
target_include_directories(meticulous-dial-qt PRIVATE ${QRCODEGEN_INCLUDE} ${CMAKE_CURRENT_BINARY_DIR}/generated)
dial_use_sentry(meticulous-dial-qt)

# The QML tree (with its assets symlinks resolved) is assembled by scripts/package-deb.sh.
install(TARGETS meticulous-dial-qt RUNTIME DESTINATION bin)

# Enables the QML debugger/profiler (-qmljsdebugger=port:<n>) for qmlprofiler; never in the package.
option(DIAL_QML_DEBUG "Build with the QML debugging services" OFF)
if(DIAL_QML_DEBUG)
    target_compile_definitions(meticulous-dial-qt PRIVATE QT_QML_DEBUG)
endif()

option(DIAL_BUILD_TESTS "Build the C++ unit tests" OFF)
if(DIAL_BUILD_TESTS)
    enable_testing()
    find_package(Qt6 REQUIRED COMPONENTS Test QuickTest)
    add_subdirectory(tests)
endif()

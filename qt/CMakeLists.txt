cmake_minimum_required(VERSION 3.21)
project(meticulous-dial-qt VERSION 0.1.0 LANGUAGES CXX)

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

add_executable(meticulous-dial-qt
    src/main.cpp
    src/socketio.cpp src/socketio.h
    src/native.cpp src/native.h
    src/plotline.cpp src/plotline.h
    src/lottieitem.cpp src/lottieitem.h
    src/qrcodeitem.cpp src/qrcodeitem.h
    ${DIAL_COMMUNITY_SOURCES}
)

target_compile_definitions(meticulous-dial-qt PRIVATE
    DIAL_QT_VERSION="${PROJECT_VERSION}"
    DIAL_QML_INSTALL_DIR="${CMAKE_INSTALL_PREFIX}/share/meticulous-dial-qt/qml")

target_link_libraries(meticulous-dial-qt PRIVATE
    Qt6::Core Qt6::Gui Qt6::Qml Qt6::Quick Qt6::WebSockets Qt6::Network Qt6::Concurrent PkgConfig::RLOTTIE ${QRCODEGEN_LIB} PkgConfig::LIBCRYPTO)
target_include_directories(meticulous-dial-qt PRIVATE ${QRCODEGEN_INCLUDE})

# The QML tree (with its assets symlinks resolved) is assembled by scripts/package-deb.sh.
install(TARGETS meticulous-dial-qt RUNTIME DESTINATION bin)

option(DIAL_BUILD_TESTS "Build the C++ unit tests" OFF)
if(DIAL_BUILD_TESTS)
    enable_testing()
    find_package(Qt6 REQUIRED COMPONENTS Test QuickTest)
    add_subdirectory(tests)
endif()

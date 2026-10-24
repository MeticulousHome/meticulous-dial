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

add_executable(meticulous-dial-qt
    src/main.cpp
    src/socketio.cpp src/socketio.h
    src/native.cpp src/native.h
    src/plotline.cpp src/plotline.h
    src/lottieitem.cpp src/lottieitem.h
)

target_compile_definitions(meticulous-dial-qt PRIVATE
    DIAL_QT_VERSION="${PROJECT_VERSION}"
    DIAL_QML_INSTALL_DIR="${CMAKE_INSTALL_PREFIX}/share/meticulous-dial-qt/qml")

target_link_libraries(meticulous-dial-qt PRIVATE
    Qt6::Core Qt6::Gui Qt6::Qml Qt6::Quick Qt6::WebSockets Qt6::Network Qt6::Concurrent PkgConfig::RLOTTIE)

# The QML tree (with its assets symlinks resolved) is assembled by scripts/package-deb.sh.
install(TARGETS meticulous-dial-qt RUNTIME DESTINATION bin)

option(DIAL_BUILD_TESTS "Build the C++ unit tests" OFF)
if(DIAL_BUILD_TESTS)
    enable_testing()
    find_package(Qt6 REQUIRED COMPONENTS Test QuickTest)
    add_subdirectory(tests)
endif()

# The Qt side of the Community contract test (../run.sh): a driver around the Qt Dial's Community
# uploader, built from the same sources as the Dial (qt/src/community.cpp and qt/src/community/), with
# the Dial's C++ standard and Qt 6.4 in the qt-dial-bookworm image. A project of its own so the contract
# test needs no change to qt/CMakeLists.txt.
cmake_minimum_required(VERSION 3.21)
project(community-contract-cpp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 6.4 REQUIRED COMPONENTS Core Network)
find_package(PkgConfig REQUIRED)
pkg_check_modules(LIBCRYPTO REQUIRED IMPORTED_TARGET libcrypto)

set(DIAL_SRC ${CMAKE_CURRENT_SOURCE_DIR}/../../../src)
add_executable(community-contract-cpp
    main.cpp
    ${DIAL_SRC}/community/json.cpp ${DIAL_SRC}/community/json.h
    ${DIAL_SRC}/community/crypto.cpp ${DIAL_SRC}/community/crypto.h
    ${DIAL_SRC}/community/model.cpp ${DIAL_SRC}/community/model.h
    ${DIAL_SRC}/community/storage.cpp ${DIAL_SRC}/community/storage.h
    ${DIAL_SRC}/community/diagnostics.cpp ${DIAL_SRC}/community/diagnostics.h
    ${DIAL_SRC}/community/http.cpp ${DIAL_SRC}/community/http.h
    ${DIAL_SRC}/community/service.cpp ${DIAL_SRC}/community/service.h
    ${DIAL_SRC}/community.cpp ${DIAL_SRC}/community.h
)
target_include_directories(community-contract-cpp PRIVATE ${DIAL_SRC})
target_link_libraries(community-contract-cpp PRIVATE Qt6::Core Qt6::Network PkgConfig::LIBCRYPTO)

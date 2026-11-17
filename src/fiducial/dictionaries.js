// Marker dictionaries available from js-aruco2. file: null = built into aruco.js.
// tau: minimum Hamming distance, precomputed for files that don't include it (saves up to ~2.5 s on first use).
export const DICTIONARIES = [
  { name: 'ARUCO_MIP_36h12', label: 'ArUco MIP 36h12', file: null },
  { name: 'ARUCO', label: 'ArUco original (js-aruco)', file: null },
  { name: 'ARUCO_DEFAULT_OPENCV', label: 'ArUco original (OpenCV DICT_ARUCO_ORIGINAL)', file: 'aruco_default_opencv.js' },
  { name: 'ARUCO_4X4_1000', label: 'ArUco 4×4 (OpenCV DICT_4X4_1000)', file: 'aruco_4x4_1000.js', tau: 2 },
  { name: 'ARUCO_5X5_1000', label: 'ArUco 5×5 (OpenCV DICT_5X5_1000)', file: 'aruco_5x5_1000.js', tau: 5 },
  { name: 'ARUCO_6X6_1000', label: 'ArUco 6×6 (OpenCV DICT_6X6_1000)', file: 'aruco_6x6_1000.js', tau: 9 },
  { name: 'ARUCO_7X7_1000', label: 'ArUco 7×7 (OpenCV DICT_7X7_1000)', file: 'aruco_7x7_1000.js', tau: 14 },
  { name: 'ARUCO_MIP_16h3', label: 'ArUco MIP 16h3', file: 'aruco_mip_16h3.js' },
  { name: 'ARUCO_MIP_25h7', label: 'ArUco MIP 25h7', file: 'aruco_mip_25h7.js' },
  { name: 'APRILTAG_16h5', label: 'AprilTag 16h5', file: 'apriltag_16h5.js' },
  { name: 'APRILTAG_25h9', label: 'AprilTag 25h9', file: 'apriltag_25h9.js' },
  { name: 'APRILTAG_36h11', label: 'AprilTag 36h11', file: 'apriltag_36h11.js' },
  { name: 'APRILTAG_25h7', label: 'AprilTag 25h7', file: 'apriltag_25h7.js' },
  { name: 'APRILTAG_36h9', label: 'AprilTag 36h9', file: 'apriltag_36h9.js' },
  { name: 'APRILTAG_36h10', label: 'AprilTag 36h10', file: 'apriltag_36h10.js' },
  { name: 'ARTAG', label: 'ARTag', file: 'artag.js' },
  { name: 'ARTOOLKITPLUS', label: 'ARToolKitPlus', file: 'artoolkitplus.js', tau: 4 },
  { name: 'ARTOOLKITPLUSBCH', label: 'ARToolKitPlus BCH', file: 'artoolkitplusbch.js', tau: 9 },
  { name: 'CHILITAGS', label: 'Chilitags', file: 'chilitags.js' },
];

export const DICT_BY_NAME = Object.fromEntries(DICTIONARIES.map((d) => [d.name, d]));

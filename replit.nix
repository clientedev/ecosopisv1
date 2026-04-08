{pkgs}: {
  deps = [
    pkgs.pkg-config
    pkgs.openssl
    pkgs.libffi
    pkgs.gcc
    pkgs.libjpeg
    pkgs.zlib
  ];
}

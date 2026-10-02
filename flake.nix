{
  description = "nexdune — run large MoE models (GLM-5.2, OLMoE, DeepSeek V4 Flash) on a consumer machine";

  # flake.lock (committed) pins these branch inputs to exact commit SHAs,
  # so builds are reproducible; refresh with `nix flake update`.
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {inherit system;};

        # Python with the packages needed by the offline converter tools
        pythonEnv = pkgs.python3.withPackages (
          ps:
            with ps; [
              torch
              safetensors
              huggingface-hub
              numpy
              tokenizers
              datasets
            ]
        );

        isDarwin = pkgs.stdenv.hostPlatform.isDarwin;

        # Real version from the engine's single source of truth (c/version.py).
        nexduneVersion = let
          m = builtins.match ''.*__version__ = "([^"]+)".*'' (builtins.readFile ./c/version.py);
        in
          if m == null
          then "0"
          else builtins.head m;

        # Apple clang has no OpenMP runtime and the Makefile only finds libomp via
        # `brew`, absent here; expose omp.h + libomp as OMPDIR or macOS goes single-threaded.
        nexduneOmp = pkgs.symlinkJoin {
          name = "nexdune-openmp";
          paths = [pkgs.llvmPackages.openmp pkgs.llvmPackages.openmp.dev];
        };

        # Portable default per arch — never -mcpu=native, which would pin a
        # distributed binary to the builder's core and break substitution.
        archBaseline =
          if pkgs.stdenv.hostPlatform.isx86_64
          then "x86-64-v3"
          else if isDarwin
          then "" # arm64 macOS: NEON is baseline
          else "armv8-a";

        # Build args: portable ARCH, plus (on macOS) OpenMP via OMPDIR and the
        # Metal backend — Apple clang provides neither on its own.
        buildArgs =
          "ARCH=${archBaseline}"
          + pkgs.lib.optionalString isDarwin " OMPDIR=${nexduneOmp} METAL=1";

        nexdune = pkgs.stdenv.mkDerivation {
          pname = "nexdune";
          version = nexduneVersion;
          src = ./.;

          nativeBuildInputs = with pkgs; [makeWrapper];

          # Compiler comes from stdenv (clang on Darwin, gcc on Linux); these add
          # only the extra build/runtime libs each platform needs.
          buildInputs = with pkgs;
            lib.optionals stdenv.hostPlatform.isDarwin [
              llvmPackages.openmp # libomp runtime for the OpenMP build
              apple-sdk_15 # SDK 15 headers enable the Metal residency-set path
            ]
            ++ lib.optionals stdenv.hostPlatform.isLinux [
              stdenv.cc.cc.lib # libgomp.so.1 in the runtime closure
            ];

          buildPhase = ''
            runHook preBuild
            # `make install` builds and stages every engine it produces —
            # nexdune (GLM), olmoe, and deepseek_v4 where NEXDUNE_V4_SUPPORTED —
            # beside nexdune under $out/lib/nexdune so nexdune's HERE-relative
            # engine_for() finds each. inkling/kimi_k3 aren't in `install` yet.
            make -C c install ${buildArgs} \
              DESTDIR=$out PREFIX= BINDIR=/bin LIBEXECDIR=/lib/nexdune
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall

            # `make install` handled the engines, nexdune and the support
            # modules; two fixups remain:

            # 1. `make install`'s file lists miss two things packaged Python
            #    needs: v4_dsml.py (openai_server.py imports it unconditionally,
            #    so `nexdune serve` / `nexdune web` would ModuleNotFoundError) and
            #    tools/iq3xxs_grid.json (iq3_pack.py loads it for `nexdune convert
            #    --xbits e8`, with no fallback). Back them in — each guard
            #    defers to a future `make install` that stages them itself.
            [ -e "$out/lib/nexdune/v4_dsml.py" ] || \
              install -m 644 c/v4_dsml.py "$out/lib/nexdune/"
            [ -e "$out/lib/nexdune/v41_dsml.py" ] || \
              install -m 644 c/v41_dsml.py "$out/lib/nexdune/"
            [ -e "$out/lib/nexdune/tools/iq3xxs_grid.json" ] || \
              install -m 644 c/tools/iq3xxs_grid.json "$out/lib/nexdune/tools/"

            # 2. nexdune dispatches relative to its own dir, so it must sit beside
            #    the engines; that also frees $out/bin/nexdune for the wrapper. The
            #    engine is re-exposed as $out/bin/nexdune for `nix run .#engine`.
            mv $out/bin/nexdune $out/lib/nexdune/nexdune
            ln -s ../lib/nexdune/nexdune $out/bin/nexdune

            # Wrap nexdune through pythonEnv. NEXDUNE_ENGINE is deliberately NOT set:
            # c/nexdune's engine_for() routes EVERY model to GLM whenever
            # NEXDUNE_ENGINE is present, defeating per-model dispatch. Left unset,
            # nexdune resolves each engine beside itself (nexdune / olmoe /
            # deepseek_v4 under $out/lib/nexdune). PYTHONPATH makes `import
            # openai_server` / `resource_plan` / `doctor` / `v4_dsml` resolve.
            makeWrapper ${pythonEnv}/bin/python $out/bin/nexdune \
              --add-flags "$out/lib/nexdune/nexdune" \
              --set PYTHONPATH "$out/lib/nexdune:${pythonEnv}/${pkgs.python3.sitePackages}"
            runHook postInstall
          '';

          # `make test-c` isn't hermetic in a sandbox (test_ssd_probe timing,
          # Linux test_uring/io_uring); installCheckPhase validates instead.
          doCheck = false;

          # Offline verification that the multi-engine layout is correct: the
          # engines reached $out, the backfilled convert data asset is present,
          # the wrapper starts (`nexdune --version` argparse-exits before any model
          # load), and the serve import surface (openai_server -> v4_dsml)
          # resolves. Not versionCheckHook: nexdune's version string is
          # unrelated to this derivation's `version`.
          doInstallCheck = true;
          installCheckPhase = ''
            runHook preInstallCheck
            # An install check must not mutate $out; block the .pyc these imports write.
            export PYTHONDONTWRITEBYTECODE=1
            test -x $out/lib/nexdune/nexdune
            test -x $out/lib/nexdune/olmoe
            test -f $out/lib/nexdune/tools/iq3xxs_grid.json
            $out/bin/nexdune --version
            PYTHONPATH=$out/lib/nexdune ${pythonEnv}/bin/python -c 'import openai_server'
            runHook postInstallCheck
          '';

          meta = with pkgs.lib; {
            description = "Run large MoE models (GLM-5.2, OLMoE, DeepSeek V4 Flash) in pure C, experts streamed from disk";
            homepage = "https://github.com/JustVugg/nexdune";
            license = licenses.asl20;
            platforms = with platforms; linux ++ darwin;
            mainProgram = "nexdune";
          };
        };
      in {
        packages = {
          default = nexdune;
          inherit nexdune;
        };

        apps = {
          default = {
            type = "app";
            program = pkgs.lib.getExe nexdune;
          };
          # `nix run .#engine` runs the engine binary directly, skipping the
          # nexdune launcher. Named "engine", not "nexdune", so it doesn't shadow
          # packages.nexdune (whose mainProgram is nexdune).
          engine = {
            type = "app";
            program = "${nexdune}/bin/nexdune";
          };
        };

        formatter = pkgs.alejandra;

        devShells.default = pkgs.mkShell {
          inputsFrom = [nexdune];

          packages = with pkgs; [
            pythonEnv
            gcc
            gnumake
            clang-tools # clangd / clang-tidy for IDE support
            pkg-config
          ];

          shellHook = ''
            echo "🐦 nexdune dev shell"
            echo "  gcc: $(gcc --version | head -1)"
            echo "  python: $(python3 --version)"
            echo ""
            echo "Build the engine:   make -C c nexdune"
            echo "Run the converter:  python c/nexdune convert --model /path/to/glm52_i4"
            echo "Chat:               NEXDUNE_MODEL=/path/to/glm52_i4 ./c/nexdune ..."
          '';
        };
      }
    );
}

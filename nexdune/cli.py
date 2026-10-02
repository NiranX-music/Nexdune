"""Entry point for `nexdune` when installed via pip.

Delegates to the original c/nexdune script which handles all subcommands.
This wrapper exists so `pip install nexdune-engine` creates a `nexdune` console
script that works without the user having to add c/ to PATH manually.
"""

import os
import sys
import runpy


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    engine_dir = os.path.join(os.path.dirname(here), "c")
    launcher = os.path.join(engine_dir, "nexdune")
    if not os.path.exists(launcher):
        launcher = os.path.join(engine_dir, "nexdune")

    if not os.path.exists(launcher):
        sys.exit(
            "nexdune engine directory not found.\n"
            "Install from source: git clone + pip install -e ."
        )

    sys.path.insert(0, engine_dir)
    sys.argv[0] = launcher
    runpy.run_path(launcher, run_name="__main__")


if __name__ == "__main__":
    main()

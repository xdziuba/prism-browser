#!/usr/bin/env python3
"""Send a real X11 key to a named window on an isolated test display."""

import argparse
import ctypes
import ctypes.util
import os
import time


class WindowAttributes(ctypes.Structure):
    _fields_ = [
        ("x", ctypes.c_int), ("y", ctypes.c_int),
        ("width", ctypes.c_int), ("height", ctypes.c_int),
        ("border_width", ctypes.c_int), ("depth", ctypes.c_int),
        ("visual", ctypes.c_void_p), ("root", ctypes.c_ulong),
        ("window_class", ctypes.c_int), ("bit_gravity", ctypes.c_int),
        ("win_gravity", ctypes.c_int), ("backing_store", ctypes.c_int),
        ("backing_planes", ctypes.c_ulong), ("backing_pixel", ctypes.c_ulong),
        ("save_under", ctypes.c_int), ("colormap", ctypes.c_ulong),
        ("map_installed", ctypes.c_int), ("map_state", ctypes.c_int),
        ("all_event_masks", ctypes.c_long), ("your_event_mask", ctypes.c_long),
        ("do_not_propagate_mask", ctypes.c_long),
        ("override_redirect", ctypes.c_int), ("screen", ctypes.c_void_p),
    ]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("window_name")
    parser.add_argument("keys", nargs="+")
    args = parser.parse_args()
    if not os.environ.get("DISPLAY") or os.environ["DISPLAY"] == ":0":
        raise RuntimeError("Use an isolated X11 display, not the user desktop")

    x11 = ctypes.CDLL(ctypes.util.find_library("X11"))
    xtst = ctypes.CDLL(ctypes.util.find_library("Xtst"))
    display_type = ctypes.c_void_p
    window_type = ctypes.c_ulong
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XOpenDisplay.restype = display_type
    x11.XDefaultRootWindow.argtypes = [display_type]
    x11.XDefaultRootWindow.restype = window_type
    x11.XDisplayWidth.argtypes = [display_type, ctypes.c_int]
    x11.XDisplayHeight.argtypes = [display_type, ctypes.c_int]
    x11.XQueryTree.argtypes = [
        display_type, window_type, ctypes.POINTER(window_type),
        ctypes.POINTER(window_type), ctypes.POINTER(ctypes.POINTER(window_type)),
        ctypes.POINTER(ctypes.c_uint),
    ]
    x11.XQueryTree.restype = ctypes.c_int
    x11.XFetchName.argtypes = [display_type, window_type, ctypes.POINTER(ctypes.c_char_p)]
    x11.XFetchName.restype = ctypes.c_int
    x11.XFree.argtypes = [ctypes.c_void_p]
    x11.XGetWindowAttributes.argtypes = [
        display_type, window_type, ctypes.POINTER(WindowAttributes)]
    x11.XSetInputFocus.argtypes = [display_type, window_type, ctypes.c_int, window_type]
    x11.XRaiseWindow.argtypes = [display_type, window_type]
    x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
    x11.XStringToKeysym.restype = window_type
    x11.XKeysymToKeycode.argtypes = [display_type, window_type]
    x11.XKeysymToKeycode.restype = ctypes.c_uint
    x11.XkbKeycodeToKeysym.argtypes = [
        display_type, ctypes.c_uint, ctypes.c_uint, ctypes.c_uint]
    x11.XkbKeycodeToKeysym.restype = window_type
    x11.XSync.argtypes = [display_type, ctypes.c_int]
    x11.XCloseDisplay.argtypes = [display_type]
    xtst.XTestFakeKeyEvent.argtypes = [display_type, ctypes.c_uint, ctypes.c_int, window_type]
    xtst.XTestFakeMotionEvent.argtypes = [
        display_type, ctypes.c_int, ctypes.c_int, ctypes.c_int, window_type]
    xtst.XTestFakeButtonEvent.argtypes = [
        display_type, ctypes.c_uint, ctypes.c_int, window_type]

    display = x11.XOpenDisplay(None)
    if not display:
        raise RuntimeError("Cannot open X11 display")

    def search(parent):
        root = window_type()
        parent_out = window_type()
        children = ctypes.POINTER(window_type)()
        count = ctypes.c_uint()
        if not x11.XQueryTree(display, parent, ctypes.byref(root),
                             ctypes.byref(parent_out), ctypes.byref(children),
                             ctypes.byref(count)):
            return None
        try:
            for child in (children[i] for i in range(count.value)):
                name = ctypes.c_char_p()
                attributes = WindowAttributes()
                x11.XGetWindowAttributes(display, child, ctypes.byref(attributes))
                if (args.window_name == ':main' and attributes.map_state == 2
                        and attributes.width > 500 and attributes.height > 400):
                    return child
                if x11.XFetchName(display, child, ctypes.byref(name)) and name.value:
                    title = name.value.decode(errors="replace")
                    if (attributes.map_state == 2 and
                            (args.window_name in title or
                             (args.window_name == ':dialog' and
                              attributes.width > 500 and attributes.height > 400))):
                        x11.XFree(name)
                        return child
                    x11.XFree(name)
                found = search(child)
                if found:
                    return found
        finally:
            if children:
                x11.XFree(children)
        return None

    window = search(x11.XDefaultRootWindow(display))
    if not window:
        raise RuntimeError(f"No window title contains {args.window_name!r}")
    x11.XRaiseWindow(display, window)
    x11.XSetInputFocus(display, window, 2, 0)
    x11.XSync(display, 0)

    def keycode(name):
        aliases = {'/': 'slash', '-': 'minus', '_': 'underscore', ' ': 'space'}
        keysym = x11.XStringToKeysym(aliases.get(name, name).encode())
        if not keysym:
            raise RuntimeError(f"Unknown keysym: {name}")
        code = x11.XKeysymToKeycode(display, keysym)
        if not code:
            raise RuntimeError(f"Unknown key: {name}")
        shifted = x11.XkbKeycodeToKeysym(display, code, 0, 0) != keysym
        return code, shifted

    def press(name):
        code, shifted = keycode(name)
        if shifted:
            xtst.XTestFakeKeyEvent(display, keycode('Shift_L')[0], 1, 0)
        xtst.XTestFakeKeyEvent(display, code, 1, 0)
        xtst.XTestFakeKeyEvent(display, code, 0, 0)
        if shifted:
            xtst.XTestFakeKeyEvent(display, keycode('Shift_L')[0], 0, 0)

    for item in args.keys:
        if item.startswith("sleep:"):
            x11.XSync(display, 0)
            time.sleep(float(item.removeprefix("sleep:")) / 1000)
        elif item.startswith("type:"):
            for character in item.removeprefix("type:"):
                press(character)
        elif item.startswith("click:"):
            if item == 'click:dialog-open':
                attributes = WindowAttributes()
                x11.XGetWindowAttributes(display, window, ctypes.byref(attributes))
                x = attributes.x + attributes.width - 52
                y = attributes.y + attributes.height - 24
            else:
                x, y = (int(value) for value in item.removeprefix("click:").split(','))
            if (x < 0 or y < 0 or x >= x11.XDisplayWidth(display, 0)
                    or y >= x11.XDisplayHeight(display, 0)):
                raise RuntimeError("X11 display is too small for the native dialog")
            xtst.XTestFakeMotionEvent(display, -1, x, y, 0)
            xtst.XTestFakeButtonEvent(display, 1, 1, 0)
            xtst.XTestFakeButtonEvent(display, 1, 0, 0)
        elif item == "Ctrl+L":
            control = keycode("Control_L")[0]
            xtst.XTestFakeKeyEvent(display, control, 1, 0)
            press("l")
            xtst.XTestFakeKeyEvent(display, control, 0, 0)
        else:
            press(item)
        x11.XSync(display, 0)
    x11.XCloseDisplay(display)


if __name__ == "__main__":
    main()

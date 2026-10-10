#!/usr/bin/env python3
"""Drag the sole CRX from an isolated Nautilus window into Chromium."""

import argparse
import ctypes
import ctypes.util
import os
import time


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("folder_title")
    args = parser.parse_args()
    if os.environ.get("DISPLAY") in (None, ":0"):
        raise RuntimeError("Use an isolated X11 display, not the user desktop")

    x11 = ctypes.CDLL(ctypes.util.find_library("X11"))
    xtst = ctypes.CDLL(ctypes.util.find_library("Xtst"))
    dpy = ctypes.c_void_p
    win = ctypes.c_ulong
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XOpenDisplay.restype = dpy
    x11.XDefaultRootWindow.argtypes = [dpy]
    x11.XDefaultRootWindow.restype = win
    x11.XQueryTree.argtypes = [
        dpy, win, ctypes.POINTER(win), ctypes.POINTER(win),
        ctypes.POINTER(ctypes.POINTER(win)), ctypes.POINTER(ctypes.c_uint),
    ]
    x11.XQueryTree.restype = ctypes.c_int
    x11.XFetchName.argtypes = [dpy, win, ctypes.POINTER(ctypes.c_char_p)]
    x11.XFetchName.restype = ctypes.c_int
    x11.XMoveWindow.argtypes = [dpy, win, ctypes.c_int, ctypes.c_int]
    x11.XRaiseWindow.argtypes = [dpy, win]
    x11.XDisplayWidth.argtypes = [dpy, ctypes.c_int]
    x11.XDisplayHeight.argtypes = [dpy, ctypes.c_int]
    x11.XSync.argtypes = [dpy, ctypes.c_int]
    x11.XCloseDisplay.argtypes = [dpy]
    x11.XFree.argtypes = [ctypes.c_void_p]
    xtst.XTestFakeMotionEvent.argtypes = [
        dpy, ctypes.c_int, ctypes.c_int, ctypes.c_int, win]
    xtst.XTestFakeButtonEvent.argtypes = [dpy, ctypes.c_uint, ctypes.c_int, win]
    display = x11.XOpenDisplay(None)
    if not display:
        raise RuntimeError("Cannot open X11 display")
    if x11.XDisplayWidth(display, 0) < 1300 or x11.XDisplayHeight(display, 0) < 1200:
        raise RuntimeError("The CRX drag probe requires a 1600x1200 test display")

    def find_window(parent):
        root, parent_out = win(), win()
        children = ctypes.POINTER(win)()
        count = ctypes.c_uint()
        if not x11.XQueryTree(display, parent, ctypes.byref(root),
                             ctypes.byref(parent_out), ctypes.byref(children),
                             ctypes.byref(count)):
            return None
        try:
            for child in (children[index] for index in range(count.value)):
                name = ctypes.c_char_p()
                if x11.XFetchName(display, child, ctypes.byref(name)) and name.value:
                    title = name.value.decode(errors="replace")
                    x11.XFree(name)
                    if title == args.folder_title:
                        return child
                nested = find_window(child)
                if nested:
                    return nested
        finally:
            if children:
                x11.XFree(children)
        return None

    window = None
    for _ in range(50):
        window = find_window(x11.XDefaultRootWindow(display))
        if window:
            break
        time.sleep(0.1)
    if not window:
        raise RuntimeError(f"Nautilus window {args.folder_title!r} was not found")
    x11.XMoveWindow(display, window, 0, 800)
    x11.XRaiseWindow(display, window)
    x11.XSync(display, 0)
    time.sleep(0.5)

    def move(x, y):
        xtst.XTestFakeMotionEvent(display, -1, int(x), int(y), 0)
        x11.XSync(display, 0)

    # In a single-file Nautilus folder, the CRX icon sits at (305, 925).
    # Chromium at (10, 10) ends above y=860, leaving the source visible.
    move(305, 925)
    time.sleep(0.25)
    xtst.XTestFakeButtonEvent(display, 1, 1, 0)
    x11.XSync(display, 0)
    for step in range(1, 61):
        fraction = step / 60
        move(305 + 395 * fraction, 925 - 475 * fraction)
        time.sleep(0.025)
    time.sleep(0.5)
    xtst.XTestFakeButtonEvent(display, 1, 0, 0)
    x11.XSync(display, 0)
    time.sleep(1)
    # Accept the browser-native extension permission bubble.
    move(765, 181)
    xtst.XTestFakeButtonEvent(display, 1, 1, 0)
    xtst.XTestFakeButtonEvent(display, 1, 0, 0)
    x11.XSync(display, 0)
    x11.XCloseDisplay(display)


if __name__ == "__main__":
    main()

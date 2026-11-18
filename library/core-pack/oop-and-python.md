# Object-Oriented Programming and Python Basics

The four pillars of OOP are encapsulation (bundling data with the methods that use it and hiding details), abstraction (exposing only what is necessary), inheritance (a class reusing another class) and polymorphism (one interface, many behaviours, for example method overriding). A class is a blueprint and an object is an instance of it. A constructor initialises a new object; in Python it is the __init__ method.

Python is dynamically typed and interpreted. Core types are int, float, str, bool, list, tuple, set and dict. A list is ordered and mutable; a tuple is ordered and immutable; a set stores unique items; a dict maps keys to values. A list comprehension builds a list in one line, for example [x * x for x in range(5)].

Functions are defined with def and may have default and keyword arguments. A lambda is a small anonymous function. A decorator wraps a function to add behaviour. A generator uses yield to produce values one at a time and saves memory. Exceptions are handled with try, except, else and finally. The with statement manages resources such as files and closes them automatically.

Scope follows the LEGB rule: Local, Enclosing, Global, Built-in. Mutable default arguments are a common bug because they are created once. The is operator checks identity, while == checks equality. Modules are imported with import, and packages are folders of modules.

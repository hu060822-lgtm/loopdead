#!/usr/bin/env python3
"""Paints DEAD LOOP levels into JSON (src/levels/levelNN.json). Dev-only helper."""
import json, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else 'src/levels'
ONLY = sys.argv[2] if len(sys.argv) > 2 else None

class L:
    def __init__(s, id, name, world, w, h):
        s.d = dict(id=id, name=name, world=world, width=w, height=h, spawn=None, exit=None, objects=[])
        s.g = [['.'] * w for _ in range(h)]
        s.w, s.h = w, h
        s.box(0, 0, w - 1, 0)        # ceiling
        s.box(0, 0, 0, h - 1)        # walls
        s.box(w - 1, 0, w - 1, h - 1)
    def box(s, x0, y0, x1, y1, ch='#'):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                s.g[y][x] = ch
        return s
    def obj(s, id, type, x, y, w=1, h=1, **props):
        o = dict(id=id, type=type, x=x, y=y, width=w, height=h)
        if props: o['properties'] = props
        s.d['objects'].append(o)
    def hint(s, id, x, y, text):
        s.obj(id, 'hint', x, y, text=text)
    def carve(s, x0, y0, x1, y1):
        return s.box(x0, y0, x1, y1, '.')
    def door(s, id, x, y, h, **props):
        """Door with solid wall above it up to the ceiling."""
        if y > 1: s.box(x, 1, x, y - 1)
        s.obj(id, 'door', x, y, 1, h, **props)
    def save(s):
        s.d['tiles'] = [''.join(r) for r in s.g]
        d = dict(id=s.d['id'], name=s.d['name'], world=s.d['world'], width=s.w, height=s.h,
                 spawn=s.d['spawn'], exit=s.d['exit'])
        if 'loopDuration' in s.d: d['loopDuration'] = s.d['loopDuration']
        if s.d.get('solidGhosts'): d['solidGhosts'] = True
        d['tiles'] = s.d['tiles']; d['objects'] = s.d['objects']
        with open(os.path.join(OUT, s.d['id'] + '.json'), 'w') as f:
            json.dump(d, f, indent=2, ensure_ascii=False)
        if ONLY is None or ONLY == s.d['id']:
            print('\n'.join(d['tiles']), '\n')

# ---------------------------------------------------------------- 01
l = L('level01', 'First Death', 'LEARNING TO DIE', 32, 16)
l.box(1, 13, 30, 15)
l.box(11, 12, 18, 12, '^')
l.box(26, 11, 30, 12)             # raised exit ledge
l.d['spawn'] = dict(x=3, y=12); l.d['exit'] = dict(x=28, y=10)
l.hint('h1', 2, 8, '← →  MOVE')
l.hint('h2', 2, 9, 'SPACE  JUMP')
l.hint('h3', 2, 10, 'SHIFT  DASH')
l.save()

# ---------------------------------------------------------------- 02
l = L('level02', 'Again', 'LEARNING TO DIE', 32, 16)
l.box(1, 13, 30, 15)
l.box(13, 12, 14, 12, '^')        # a small spike bed — the only way to end a loop
l.box(25, 1, 25, 9)               # wall above the door
l.obj('d1', 'door', 25, 10, 1, 3)
l.obj('p1', 'plate', 5, 12, 1, 1, target='d1')
l.d['spawn'] = dict(x=2, y=12); l.d['exit'] = dict(x=28, y=12)
l.hint('h1', 3, 8, 'THE PLATE HOLDS THE DOOR')
l.hint('h2', 3, 9, 'ONLY WHILE SOMEONE STANDS ON IT')
l.save()

# ---------------------------------------------------------------- 03
l = L('level03', 'Corpse', 'LEARNING TO DIE', 32, 16)
l.box(1, 9, 19, 15)               # upper floor (stand on row 8)
l.box(20, 14, 30, 15)             # pit floor (stand on row 13)
l.box(5, 1, 5, 5)                 # wall above door
l.obj('d1', 'door', 5, 6, 1, 3)
l.box(24, 9, 26, 10)              # overhang above the plate
l.box(24, 11, 26, 11, 'v')
l.obj('p1', 'plate', 24, 13, 3, 1, target='d1')
l.d['spawn'] = dict(x=11, y=8); l.d['exit'] = dict(x=2, y=8)
l.hint('h1', 21, 4, 'THERE IS NO WAY BACK UP')
l.save()

# ---------------------------------------------------------------- 04
l = L('level04', 'Two Jobs', 'LEARNING TO DIE', 36, 18)
l.box(1, 15, 34, 17)              # ground
l.box(7, 10, 22, 14)              # central plateau (stand on row 9)
l.box(2, 10, 4, 11)               # overhang above plate A
l.box(2, 12, 4, 12, 'v')
l.obj('pA', 'plate', 2, 14, 3, 1, target='d1')
l.obj('pB', 'plate', 26, 14, 2, 1, target='d1')
l.box(31, 14, 33, 14, '^')        # the only way out of the right pit
l.box(24, 9, 25, 9, '=')          # stepping platform
l.box(30, 7, 34, 7)               # exit ledge
l.box(31, 1, 31, 3)               # wall above door
l.obj('d1', 'door', 31, 4, 1, 3, require='all')
l.d['spawn'] = dict(x=14, y=9); l.d['exit'] = dict(x=33, y=6)
l.hint('h1', 13, 4, 'THIS DOOR NEEDS BOTH PLATES')
l.save()

# ---------------------------------------------------------------- 05
l = L('level05', 'The Bait', 'LEARNING TO DIE', 30, 16)
l.box(1, 13, 28, 15)              # ground
l.box(10, 11, 28, 11)             # tunnel ceiling = upper walkway
l.box(28, 1, 28, 12)              # right wall
l.box(26, 10, 27, 10, '^')
l.box(5, 1, 5, 8)                 # wall above door
l.obj('d1', 'door', 5, 9, 1, 4)
l.obj('p1', 'plate', 24, 12, 2, 1, target='d1')
l.obj('w1', 'walker', 20, 12, 1, 1, patrol=[19, 22], sight=5, dir=1)
l.d['spawn'] = dict(x=13, y=10); l.d['exit'] = dict(x=2, y=12)
l.hint('h1', 11, 6, 'IT FOLLOWS WHATEVER IS ALIVE')
l.save()

# ---------------------------------------------------------------- 06
l = L('level06', 'The Machine', 'LEARNING TO DIE', 40, 20)
l.box(1, 17, 38, 19)              # ground
l.box(8, 13, 20, 16)              # central plateau (stand on row 12)
l.box(2, 13, 4, 14)               # overhang above P1 (left pit)
l.box(2, 15, 4, 15, 'v')
l.obj('p1', 'plate', 2, 16, 3, 1, target='d1')
l.box(21, 13, 28, 16)             # spike bed base
l.box(21, 12, 28, 12, '^')        # spike bed — too wide to cross alone
l.box(29, 13, 38, 13)             # walkway (tunnel ceiling)
l.box(29, 15, 38, 16)             # tunnel floor
l.box(28, 14, 28, 14)             # tunnel sealed on the left
l.obj('p2', 'plate', 35, 14, 2, 1, target='d2')
l.obj('w1', 'walker', 31, 14, 1, 1, patrol=[30, 33], sight=5, dir=1)
l.box(15, 11, 16, 11, '=')        # steps up to the exit shelf
l.box(12, 9, 13, 9, '=')
l.box(1, 7, 10, 7)                # exit shelf
l.box(9, 1, 9, 3)
l.obj('d1', 'door', 9, 4, 1, 3)
l.box(6, 1, 6, 3)
l.obj('d2', 'door', 6, 4, 1, 3)
l.d['spawn'] = dict(x=17, y=12); l.d['exit'] = dict(x=3, y=6)
l.hint('h1', 22, 5, 'EVERY PAST HAS ONE JOB')
l.save()

# ================================================================ WORLD 2 — ASCENT
# ---------------------------------------------------------------- 07
l = L('level07', 'Chimney', 'ASCENT', 34, 22)
l.box(1, 20, 32, 21)              # ground (stand on row 19)
# grip chimney, 2 wide (x=3..4)
l.box(2, 3, 2, 19, 'g')
l.box(5, 4, 5, 16, 'g')
l.box(6, 5, 6, 16)                # outer face of the chimney is plain wall
l.box(3, 12, 3, 12, '>')          # spikes on the walls: switch sides to get past
l.box(4, 8, 4, 8, '<')
# top room with the plate under a spike ceiling
l.box(5, 4, 12, 4)                # floor (stand on row 3)
l.box(6, 1, 12, 1)
l.box(8, 2, 10, 2, 'v')
l.obj('p1', 'plate', 8, 3, 3, 1, target='d1')
# the ground route
l.box(18, 19, 20, 19, '^')
l.box(22, 18, 24, 19)             # a block to climb
l.box(25, 19, 28, 19, '^')
l.door('d1', 30, 16, 4)
l.d['spawn'] = dict(x=14, y=19); l.d['exit'] = dict(x=32, y=19)
l.hint('h1', 7, 13, 'RIBBED WALLS:')
l.hint('h2', 7, 14, 'JUMP OFF THEM')
l.save()

# ---------------------------------------------------------------- 08
l = L('level08', 'Recoil', 'ASCENT', 38, 20)
l.box(1, 18, 36, 19)              # ground (stand on row 17)
l.box(9, 1, 22, 15)               # low roof over the spring corridor
l.box(9, 16, 22, 16, 'v')         # one tile of headroom under spikes: no hopping
l.obj('s1', 'spring', 12, 17, 4, 1)
l.obj('s2', 'spring', 27, 17, 1, 1)
l.box(28, 17, 30, 17, '^')        # pit before the wall
l.box(31, 11, 36, 17)             # the wall (7 tiles)
l.d['spawn'] = dict(x=3, y=17); l.d['exit'] = dict(x=35, y=10)
l.hint('h1', 1, 4, 'SPRINGS THROW ANYTHING ALIVE.')
l.hint('h2', 1, 5, 'THE DEAD ONLY LIE ON THEM.')
l.save()

# ---------------------------------------------------------------- 09
l = L('level09', 'Orbit', 'ASCENT', 40, 20)
l.box(1, 12, 5, 19)               # start ledge (stand on row 11)
l.box(6, 19, 31, 19)
l.box(6, 18, 31, 18, '^')         # chasm floor
l.box(6, 1, 31, 4)                # low ceiling over the chasm
l.box(6, 5, 31, 5, 'v')
l.box(32, 12, 38, 19)             # far ledge
l.obj('s1', 'spring', 35, 11)
l.box(32, 6, 34, 6)               # perch (stand on row 5)
l.box(32, 5, 34, 5, '.')
l.box(32, 3, 34, 3, 'v')
l.obj('p1', 'plate', 32, 5, 2, 1, target='d1')
l.door('d1', 36, 8, 4)
for (i, (x, y)) in enumerate([(176, 142), (222, 143), (280, 153), (328, 154), (392, 174), (442, 176)]):
    l.obj(f'o{i + 1}', 'orb', round((x - 8) / 16, 3), round((y - 8) / 16, 3))
l.d['spawn'] = dict(x=2, y=11); l.d['exit'] = dict(x=38, y=11)
l.hint('h1', 1, 6, 'CRYSTALS GIVE BACK YOUR DASH')
l.save()

# ---------------------------------------------------------------- 10
l = L('level10', 'Brittle', 'ASCENT', 36, 18)
l.box(1, 10, 5, 17)               # start (stand on row 9)
l.box(6, 17, 27, 17)
l.box(6, 16, 27, 16, '^')
l.box(6, 10, 27, 10, 'x')         # the brittle bridge
l.carve(12, 10, 13, 10)
l.carve(20, 10, 22, 10)
l.box(28, 10, 34, 17)             # far floor
l.box(29, 6, 30, 6)
l.box(29, 7, 30, 7, 'v')
l.obj('p1', 'plate', 29, 9, 2, 1, target='d1')
l.door('d1', 32, 6, 4)
l.d['spawn'] = dict(x=2, y=9); l.d['exit'] = dict(x=34, y=9)
l.hint('h1', 7, 4, 'CRACKED STONE FALLS SOON AFTER IT IS STOOD ON')
l.save()

# ---------------------------------------------------------------- 11
l = L('level11', 'Switchback', 'ASCENT', 36, 22)
l.box(1, 20, 34, 21)              # ground (stand on row 19)
l.box(9, 19, 11, 19, '^')
l.box(15, 18, 16, 19)
l.box(17, 19, 20, 19, '^')
l.box(24, 18, 26, 19)
# grip shaft on the right
l.box(30, 4, 30, 17, 'g')
l.box(33, 4, 33, 19, 'g')
l.box(31, 19, 32, 19, '.')
l.box(34, 1, 34, 19)
l.box(33, 1, 33, 3, 'g')
# top floor running back to the left
l.box(1, 4, 29, 4)
l.box(14, 4, 19, 4, 'x')          # brittle stretch over a sealed chamber
l.box(13, 5, 13, 8); l.box(20, 5, 20, 8); l.box(13, 9, 20, 9)
l.obj('s1', 'plate', 15, 8, 2, 1, target='d1', latch=True)
l.box(18, 8, 19, 8, '^')
l.door('d1', 4, 1, 3)
l.d['spawn'] = dict(x=3, y=19); l.d['exit'] = dict(x=2, y=3)
l.hint('h1', 20, 12, 'A SWITCH STAYS ON FOR THE REST OF THE LOOP')
l.save()

# ---------------------------------------------------------------- 12
l = L('level12', 'Summit', 'ASCENT', 40, 30)
l.box(1, 20, 10, 29)              # start ground (stand on row 19)
l.box(11, 20, 24, 20, 'x')        # the brittle bridge
l.box(11, 28, 24, 29)
l.box(11, 27, 24, 27, '^')        # pit floor
l.box(11, 24, 13, 24)             # ledge in the pit with the timed switch
l.obj('t1', 'plate', 12, 23, 1, 1, target='d1', hold=2.2)
l.box(25, 20, 38, 29)             # far ground
# grip shaft x31-32, a hatch across it
l.box(30, 4, 30, 16, 'g')
l.box(33, 3, 33, 19, 'g')
l.box(31, 14, 31, 14, '>')
l.box(32, 8, 32, 8, '<')
l.obj('d1', 'door', 31, 11, 2, 1)
l.box(1, 1, 29, 3)                # ceiling mass left of the shaft
l.box(30, 1, 30, 3)
l.box(34, 4, 38, 19)              # mass right of the shaft; exit on top
l.d['spawn'] = dict(x=3, y=19); l.d['exit'] = dict(x=37, y=3)
l.save()

# ================================================================ WORLD 3 — MACHINERY
# ---------------------------------------------------------------- 13
l = L('level13', 'Freight', 'MACHINERY', 40, 20)
l.box(1, 19, 38, 19)
l.box(5, 18, 34, 18, '^')         # spike sea
l.box(1, 12, 4, 18)               # start ledge (stand on row 11)
l.obj('m1', 'platform', 5, 12, 3, 1, to=dict(x=13, y=12), speed=0.9, pause=40, delay=60)
l.box(17, 10, 18, 17)             # pillar (stand on row 9)
l.obj('m2', 'platform', 20, 15, 2, 1, to=dict(x=20, y=6), speed=1.0, pause=30)
l.box(23, 6, 27, 6)               # high ledge H (stand on row 5)
l.obj('p1', 'plate', 25, 5, 2, 1, target='e3')
l.box(24, 2, 27, 2)
l.box(25, 3, 26, 3, 'v')
l.obj('e3', 'platform', 30, 12, 3, 1, to=dict(x=30, y=3), speed=0.9, mode='plate')
l.box(33, 3, 38, 3)               # exit ledge (stand on row 2)
l.d['spawn'] = dict(x=2, y=11); l.d['exit'] = dict(x=37, y=2)
l.hint('h1', 6, 4, 'SOME LIFTS ONLY RISE WHILE THEIR PLATE IS HELD')
l.save()

# ---------------------------------------------------------------- 14
l = L('level14', 'Conveyor', 'MACHINERY', 38, 18)
l.box(1, 16, 36, 17)              # ground (stand on row 15)
l.box(5, 9, 20, 9)                # shelf with a belt running left
l.obj('c1', 'conveyor', 5, 9, 16, 1, speed=-0.8)
l.box(9, 5, 13, 5); l.box(10, 6, 12, 6, 'v')
l.box(5, 10, 5, 15)               # pocket wall
l.obj('p1', 'plate', 1, 15, 4, 1, target='d1')
l.obj('s1', 'spring', 22, 15)
# the ground route: belts against you under a low spike ceiling
l.box(24, 11, 29, 11); l.box(24, 12, 29, 12, 'v')
l.obj('c2', 'conveyor', 23, 16, 8, 1, speed=-0.9)
l.box(26, 15, 27, 15, '^')
l.door('d1', 32, 12, 4)
l.d['spawn'] = dict(x=8, y=15); l.d['exit'] = dict(x=35, y=15)
l.hint('h1', 14, 2, 'BELTS CARRY EVERYTHING. EVEN YOU.')
l.save()

# ---------------------------------------------------------------- 15
l = L('level15', 'Deadline', 'MACHINERY', 40, 18)
l.box(1, 16, 38, 17)              # ground (stand on row 15)
l.box(1, 15, 4, 15, '^')
l.box(1, 5, 4, 5, 'x')            # brittle perch with the timed switch
l.obj('t1', 'plate', 3, 4, 1, 1, target='d1', hold=1.5)
l.obj('m1', 'platform', 5, 14, 2, 1, to=dict(x=5, y=5), speed=1.2, pause=20)
# the run to the door
l.box(20, 15, 23, 15, '^')
l.box(26, 11, 34, 11); l.box(26, 12, 34, 12, 'v')
l.box(27, 15, 33, 15, '^')
l.obj('o1', 'orb', (445 - 8) / 16, (227 - 8) / 16); l.obj('o2', 'orb', (491 - 8) / 16, (227 - 8) / 16)
l.door('d1', 36, 12, 4)
l.d['spawn'] = dict(x=17, y=15); l.d['exit'] = dict(x=38, y=15)
l.hint('h1', 8, 2, 'A TIMED SWITCH STAYS ON FOR A MOMENT')
l.save()

# ---------------------------------------------------------------- 16
l = L('level16', 'Undertow', 'MACHINERY', 38, 18)
l.box(1, 16, 36, 17)              # ground (stand on row 15)
l.obj('s1', 'spring', 2, 15)
l.box(6, 11, 30, 12)              # corridor roof = upper walkway U (stand on row 10)
l.box(6, 13, 30, 13, 'v')         # no room above the brute's head
l.box(24, 7, 30, 7); l.box(25, 8, 29, 8, 'v')
l.obj('w1', 'brute', 12, 15, 1, 1, patrol=[10, 14], sight=16, sightY=6, dir=1)
l.obj('c1', 'conveyor', 16, 16, 12, 1, speed=1.0)
l.carve(28, 16, 29, 16)
l.box(28, 17, 29, 17, '^')
l.box(31, 1, 36, 11)
l.d['spawn'] = dict(x=4, y=15); l.d['exit'] = dict(x=35, y=15)
l.save()

# ---------------------------------------------------------------- 17
l = L('level17', 'Assembly', 'MACHINERY', 40, 18)
l.box(1, 16, 38, 17)              # floor (stand on row 15)
l.obj('r1', 'plate', 3, 15, 2, 1, target='c1')
l.carve(8, 16, 9, 16); l.box(8, 17, 9, 17, '^')       # the belt empties into this pit
l.obj('c1', 'conveyor', 10, 16, 22, 1, speed=-1.0)
l.box(13, 1, 17, 12); l.box(14, 13, 16, 13, 'v')      # low spikes over the belt
# the slot: spikes at head height, only a body lying flat gets through
l.box(27, 3, 34, 14); l.box(28, 15, 31, 15, 'v')
l.box(34, 15, 34, 15)
l.obj('q1', 'plate', 32, 15, 2, 1, target='d1')
# the climb to the top corridor
l.box(21, 3, 21, 13, 'g'); l.box(24, 3, 24, 13, 'g')
l.box(25, 3, 26, 14)
l.box(22, 8, 22, 8, '>'); l.box(23, 4, 23, 4, '<')
l.box(18, 1, 20, 11)
l.door('d1', 35, 1, 2)
l.box(35, 3, 38, 15)
l.d['spawn'] = dict(x=6, y=15); l.d['exit'] = dict(x=37, y=2)
l.hint('h1', 2, 5, 'A PLATE CAN TURN A BELT AROUND')
l.save()

# ---------------------------------------------------------------- 18
l = L('level18', 'Engine', 'MACHINERY', 40, 22)
l.box(1, 20, 38, 21)              # ground (stand on row 19)
l.box(1, 19, 4, 19, '^')
# B: loop lift to a brittle perch with a timed switch
l.box(1, 6, 4, 6, 'x')
l.obj('t1', 'plate', 4, 5, 1, 1, target='d1', hold=1.5)
l.obj('m1', 'platform', 5, 18, 2, 1, to=dict(x=5, y=6), speed=1.3, pause=20)
# A: spring onto the belt shelf, die under its spikes; the belt drops the body onto the reversing plate
l.obj('s1', 'spring', 10, 19)
l.box(12, 15, 30, 15)             # corridor roof
l.box(12, 16, 30, 16, 'v')
l.box(12, 14, 23, 14)             # raised shelf (stand on row 13)
l.obj('c1', 'conveyor', 12, 14, 12, 1, speed=0.9)
l.box(15, 10, 17, 10); l.box(15, 11, 17, 11, 'v')
l.box(26, 13, 26, 14)
l.obj('p1', 'plate', 24, 14, 2, 1, target='c2')
# YOU: the long belt, the timed door, the grip shaft to the exit
l.obj('c2', 'conveyor', 12, 20, 18, 1, speed=-1.2)
for x in (15, 20, 25):
    l.box(x, 19, x + 1, 19, '^')
l.door('d1', 31, 16, 4)
l.box(32, 3, 32, 18, 'g')
l.box(35, 3, 35, 18, 'g')
l.box(36, 3, 38, 19)
l.d['spawn'] = dict(x=8, y=19); l.d['exit'] = dict(x=37, y=2)
l.save()

# ================================================================ WORLD 4 — LIGHT
# ---------------------------------------------------------------- 19
l = L('level19', 'Beam', 'LIGHT', 36, 22)
l.box(1, 20, 34, 21)              # ground (stand on row 19)
l.obj('p1', 'plate', 2, 19, 2, 1, target='z3')
l.box(9, 19, 10, 19, '^')
# grip shaft crossed by pulsing beams
l.box(13, 1, 13, 18, 'g')
l.box(16, 3, 16, 18, 'g')
l.obj('z1', 'laser', 13, 14, 1, 1, dir='right', pulse=dict(on=50, off=70, phase=0))
l.obj('z2', 'laser', 13, 9, 1, 1, dir='right', pulse=dict(on=50, off=70, phase=90))
# top ledge with a curtain the plate turns off
l.box(17, 3, 34, 3)
l.box(17, 4, 34, 19)
l.obj('z3', 'laser', 25, 1, 1, 1, dir='down')
l.d['spawn'] = dict(x=6, y=19); l.d['exit'] = dict(x=33, y=2)
l.hint('h1', 1, 6, 'LIGHT KILLS. PLATES,')
l.hint('h2', 1, 7, 'AND TIME, SWITCH IT OFF.')
l.save()

# ---------------------------------------------------------------- 20
l = L('level20', 'Shield', 'LIGHT', 40, 18)
l.box(1, 8, 38, 17)
l.carve(1, 10, 35, 11)            # low corridor (2 tall) with a floor-level beam
l.carve(36, 9, 38, 11)            # exit chamber
l.carve(6, 8, 7, 9)               # hole A
l.carve(19, 8, 20, 9)             # hole B
l.obj('z1', 'laser', 1, 11, 1, 1, dir='right', offset=13)
l.obj('z2', 'laser', 26, 10, 1, 1, dir='down', pulse=dict(on=45, off=45, phase=0))
l.obj('z3', 'laser', 31, 10, 1, 1, dir='down', pulse=dict(on=45, off=45, phase=45))
# the upper floor: a run with a gap and a spike strip to reach hole B
l.box(10, 7, 12, 7, '^')
l.box(14, 7, 16, 7, '^')
l.d['spawn'] = dict(x=2, y=7); l.d['exit'] = dict(x=37, y=11)
l.hint('h1', 9, 3, 'LIGHT STOPS AT THE FIRST BODY')
l.save()

# ---------------------------------------------------------------- 21
l = L('level21', 'Kindling', 'LIGHT', 40, 18)
l.box(1, 17, 38, 17)              # floor (stand on row 16)
l.box(10, 1, 38, 14)              # mass above the corridor
l.box(10, 15, 38, 15, 'v')        # one tile of headroom: nothing can be jumped
l.carve(14, 15, 14, 15); l.carve(27, 15, 27, 15)
l.obj('p1', 'plate', 2, 16, 2, 1, target=['z1', 'z2'])
l.obj('z1', 'laser', 14, 15, 1, 1, dir='down')
l.obj('z2', 'laser', 27, 15, 1, 1, dir='down', invert=True)
l.obj('w1', 'walker', 20, 16, 1, 1, patrol=[18, 23], sight=10, sightY=1, dir=1)
l.obj('w2', 'walker', 32, 16, 1, 1, patrol=[30, 35], sight=8, sightY=1, dir=-1)
l.d['spawn'] = dict(x=6, y=16); l.d['exit'] = dict(x=38, y=16)
l.hint('h1', 2, 5, 'LIGHT BURNS ANYTHING THAT WALKS')
l.save()

# ---------------------------------------------------------------- 22
l = L('level22', 'Shutter', 'LIGHT', 40, 18)
l.box(1, 16, 38, 17)              # ground (stand on row 15)
l.box(1, 15, 1, 15, '^')
l.obj('pB', 'plate', 2, 15, 2, 1, target=['z1', 'd2'])
l.obj('pA', 'plate', 8, 15, 2, 1, target=['z2', 'd1'])
l.box(11, 15, 11, 15, '^')
# two beams over one pit: both must be dark at once
l.box(16, 15, 20, 15, '^')
l.obj('z1', 'laser', 16, 1, 1, 1, dir='down')
l.obj('z2', 'laser', 20, 1, 1, 1, dir='down')
l.door('d1', 25, 12, 4, invert=True)
l.box(27, 15, 28, 15, '^')
l.door('d2', 31, 12, 4, invert=True)
l.d['spawn'] = dict(x=5, y=15); l.d['exit'] = dict(x=37, y=15)
l.hint('h1', 11, 4, 'SOME DOORS STAND OPEN UNTIL SOMEONE PRESSES')
l.save()

# ---------------------------------------------------------------- 23
l = L('level23', 'Umbrella', 'LIGHT', 40, 20)
l.box(1, 18, 38, 19)              # ground (stand on row 17)
l.obj('p1', 'plate', 2, 17, 2, 1, target='u1')
l.box(8, 17, 8, 17, '^')
for x in (13, 21, 29):
    l.obj(f'z{x}', 'laser', x, 1, 1, 1, dir='down')
l.obj('u1', 'platform', 9, 6, 3, 1, to=dict(x=30, y=6), speed=0.75, mode='plate')
l.box(16, 17, 17, 17, '^')
l.box(24, 17, 25, 17, '^')
l.box(32, 17, 33, 17, '^')
l.d['spawn'] = dict(x=5, y=17); l.d['exit'] = dict(x=37, y=17)
l.save()

# ---------------------------------------------------------------- 24
l = L('level24', 'Prism', 'LIGHT', 40, 18)
l.box(1, 8, 38, 17)               # upper floor (stand on row 7) over a buried corridor
l.carve(1, 11, 34, 12)            # corridor (2 tall, floor row 13)
l.carve(35, 9, 38, 12)            # exit chamber
l.carve(6, 8, 7, 10)              # the only way down
l.obj('z1', 'laser', 1, 12, 1, 1, dir='right', offset=13)
l.obj('z2', 'laser', 20, 11, 1, 1, dir='down', pulse=dict(on=60, off=60, phase=0))
l.obj('z3', 'laser', 36, 9, 1, 1, dir='down')
l.obj('s1', 'door', 36, 10, 1, 1, invert=True)
l.obj('w1', 'walker', 27, 12, 1, 1, patrol=[25, 31], sight=9, sightY=1, dir=-1)
l.obj('p1', 'plate', 33, 7, 2, 1, target='s1')
l.box(12, 7, 13, 7, '^'); l.box(19, 7, 20, 7, '^'); l.box(26, 7, 27, 7, '^')
l.d['spawn'] = dict(x=2, y=7); l.d['exit'] = dict(x=38, y=12)
l.save()

# ================================================================ WORLD 5 — ECHO
# ---------------------------------------------------------------- 25
l = L('level25', 'Echo', 'ECHO', 40, 20)
l.d['solidGhosts'] = True
l.box(1, 18, 38, 19)              # ground (stand on row 17)
l.box(1, 17, 1, 17, '^')
l.box(10, 15, 24, 17)             # step up (3 tiles): too high alone
l.box(19, 14, 19, 14, '^')
l.box(25, 9, 38, 17)              # the wall (6 tiles above the step)
l.d['spawn'] = dict(x=4, y=17); l.d['exit'] = dict(x=37, y=8)
l.hint('h1', 3, 6, 'HERE, WHAT YOU WERE')
l.hint('h2', 3, 7, 'IS SOLID GROUND')
l.save()

# ---------------------------------------------------------------- 26
l = L('level26', 'Tower', 'ECHO', 40, 24)
l.d['solidGhosts'] = True
l.box(1, 22, 38, 23)              # ground (stand on row 21)
l.box(14, 21, 20, 21, '^')
l.box(1, 21, 2, 21, '^')
l.box(12, 16, 20, 16)             # ledge L1 (6 tiles up)
l.box(12, 17, 13, 21)
l.box(22, 10, 38, 21)             # ledge L2 (another 6 up)
l.box(17, 13, 18, 13, 'v'); l.box(17, 12, 18, 12)
l.d['spawn'] = dict(x=4, y=21); l.d['exit'] = dict(x=37, y=9)
l.save()

# ---------------------------------------------------------------- 27
l = L('level27', 'Countdown', 'ECHO', 40, 20)
l.d['solidGhosts'] = True
l.d['loopDuration'] = 9
l.box(1, 18, 38, 19)              # ground (stand on row 17)
l.box(1, 15, 6, 17)               # high ledge, 3 tiles: only reachable off someone's head
l.obj('p1', 'plate', 3, 14, 2, 1, target='d1')
l.box(10, 17, 11, 17, '^')
l.box(15, 17, 16, 17, '^')
l.carve(23, 18, 24, 18)           # shallow pit with the second plate
l.obj('p2', 'plate', 23, 18, 2, 1, target='d1')
l.door('d1', 28, 14, 4, require='all')
l.box(31, 17, 34, 17, '^')
l.d['spawn'] = dict(x=19, y=17); l.d['exit'] = dict(x=37, y=17)
l.hint('h1', 13, 5, 'SOME LOOPS ARE SHORT')
l.save()

# ---------------------------------------------------------------- 28
l = L('level28', 'Slingshot', 'ECHO', 40, 24)
l.d['solidGhosts'] = True
l.box(1, 18, 7, 23)               # start ledge (stand on row 17)
l.box(8, 23, 24, 23)
l.box(8, 22, 24, 22, '^')         # the pit
l.box(8, 18, 24, 18, 'x')         # brittle bridge
l.carve(13, 18, 14, 18)
l.carve(19, 18, 20, 18)
l.box(25, 18, 29, 23)             # landing
l.obj('s1', 'spring', 28, 17)
l.box(30, 7, 38, 23)              # the exit shelf, 11 tiles above the spring
l.d['spawn'] = dict(x=3, y=17); l.d['exit'] = dict(x=37, y=6)
l.save()

# ---------------------------------------------------------------- 29
l = L('level29', 'Counterpoint', 'ECHO', 40, 20)
l.d['solidGhosts'] = True
l.d['loopDuration'] = 12
l.box(1, 18, 38, 19)              # ground (stand on row 17)
l.obj('p1', 'plate', 2, 17, 2, 1, target=['z1', 's1'])
l.box(11, 17, 12, 17, '^')
l.obj('z1', 'laser', 16, 1, 1, 1, dir='down')
l.door('s1', 24, 14, 4, invert=True)
l.box(28, 17, 29, 17, '^')
l.box(35, 12, 38, 17)             # the shelf: 5 tiles
l.d['spawn'] = dict(x=8, y=17); l.d['exit'] = dict(x=37, y=11)
l.save()

# ---------------------------------------------------------------- 30
l = L('level30', 'The Loop', 'ECHO', 40, 24)
l.d['solidGhosts'] = True
l.d['loopDuration'] = 24
l.box(1, 22, 38, 23)              # ground (stand on row 21)
# the corridor: no jumping, a walker, a pulsing beam
l.box(1, 18, 21, 18); l.box(1, 19, 21, 19, 'v')
l.obj('w1', 'walker', 14, 21, 1, 1, patrol=[12, 17], sight=8, sightY=1, dir=-1)
l.obj('z1', 'laser', 9, 20, 1, 1, dir='down', pulse=dict(on=50, off=70, phase=60))
# the step (3 tiles) and the grip shaft
l.box(24, 19, 38, 21)             # plateau (stand on row 18)
l.box(27, 7, 27, 17, 'g')
l.box(30, 4, 30, 18, 'g')
l.box(31, 4, 38, 18)
# the upper floor running left, with a brittle bridge over spikes
l.box(1, 8, 26, 8)                # upper floor (stand on row 7)
l.box(9, 8, 20, 8, 'x')
l.box(9, 17, 20, 17, '^')
l.box(1, 2, 4, 7)                 # the last wall: 6 tiles
l.box(27, 1, 38, 3)
l.d['spawn'] = dict(x=3, y=21); l.d['exit'] = dict(x=2, y=1)
l.hint('h1', 8, 3, 'EVERY DEATH LEAVES SOMETHING BEHIND')
l.save()

# ================================================================ WORLD 6 — MIMIC
# ---------------------------------------------------------------- 31
l = L('level31', 'Heavy', 'MIMIC', 40, 20)
l.box(1, 18, 38, 19)              # corridor floor (stand on row 17)
l.box(1, 10, 38, 10)              # upper floor (stand on row 9) = corridor roof
l.carve(10, 10, 11, 10)           # the only way down
l.box(1, 11, 2, 17)
l.obj('z1', 'laser', 2, 17, 1, 1, dir='right', offset=12)
l.box(2, 17, 2, 17, '.')
l.obj('d1', 'door', 3, 15, 1, 3)  # holds the beam back
l.box(4, 11, 8, 14)               # the cage roof
l.obj('b1', 'brute', 5, 17, 1, 1, patrol=[4, 6], sight=30, sightY=2, dir=1)
l.obj('d3', 'door', 8, 15, 1, 3)  # the cage
l.obj('c1', 'crawler', 22, 17, 1, 1, patrol=[19, 26], dir=1)
l.obj('c2', 'crawler', 30, 17, 1, 1, patrol=[28, 33], dir=-1)
l.obj('p1', 'plate', 2, 9, 2, 1, target=['d1', 'd3', 'd2'])
l.door('d2', 37, 15, 3)
l.box(37, 11, 37, 14)
l.d['spawn'] = dict(x=6, y=9); l.d['exit'] = dict(x=38, y=17)
l.hint('h1', 14, 4, 'SOME THINGS ARE TOO BIG TO JUMP')
l.save()

# ---------------------------------------------------------------- 32
l = L('level32', 'Piston', 'MIMIC', 40, 24)
l.box(1, 16, 12, 23)              # start ledge (stand on row 15)
l.box(13, 23, 27, 23); l.box(13, 22, 27, 22, '^')     # a wide spike pit
l.box(28, 16, 38, 23)             # far ledge (low)
l.obj('k1', 'crusher', 19, 3, 3, 2, sight=20)
l.box(23, 5, 38, 5)               # the high exit shelf, just below the crusher's rest
l.d['spawn'] = dict(x=4, y=15); l.d['exit'] = dict(x=36, y=4)
l.hint('h1', 2, 8, 'IT FALLS ON WHATEVER IS ALIVE BENEATH IT')
l.save()

# ---------------------------------------------------------------- 33
l = L('level33', 'Mimic', 'MIMIC', 40, 20)
l.box(1, 17, 38, 19)              # main floor (stand on row 16)
# the mimic's gallery, sealed: rows 3-6, floor row 7
l.box(1, 2, 38, 2); l.box(1, 7, 38, 7); l.box(1, 3, 9, 6)
l.carve(14, 7, 15, 7); l.box(14, 8, 15, 8, '^')        # a pit it must jump
l.box(19, 3, 38, 6)
l.obj('m1', 'mimic', 10, 6)
l.obj('p1', 'plate', 17, 6, 2, 1, target='d1')
# your lane: open on the left, a spiked low roof in the middle
l.box(10, 8, 16, 14); l.box(10, 15, 16, 15, 'v')
l.box(17, 8, 38, 12)
l.box(14, 8, 15, 8, '^')          # (after the roof: the mimic's pit really is spiked)
l.obj('q1', 'plate', 2, 16, 2, 1, target='d1')
l.door('d1', 30, 13, 4, require='all')
l.d['spawn'] = dict(x=10, y=16); l.d['exit'] = dict(x=37, y=16)
l.hint('h1', 20, 14, 'IT DOES WHAT YOU DO')
l.save()

# ---------------------------------------------------------------- 34
l = L('level34', 'Reflection', 'MIMIC', 44, 24)
l.box(1, 1, 42, 23)               # solid, then carve
# gallery N (normal mimic): rows 2-4, floor row 5, pit -> spikes row 6
l.carve(10, 2, 21, 4)
l.carve(13, 5, 16, 5); l.box(13, 6, 16, 6, '^')
l.obj('mn', 'mimic', 10, 4)
l.obj('pn', 'plate', 20, 4, 2, 1, target='d1')
# gallery M (mirror): rows 8-10, floor row 11, pit -> spikes row 12
l.carve(3, 8, 37, 10)
l.carve(10, 11, 13, 11); l.box(10, 12, 13, 12, '^')
l.obj('mm', 'mimic', 30, 10, mirror=True)
l.obj('pm', 'plate', 3, 10, 2, 1, target='d2')
# your lane: row 20 walkway under a spiked roof (row 19); tall bays where you can jump
l.carve(1, 19, 42, 20); l.box(1, 19, 42, 19, 'v')
l.carve(1, 14, 9, 20)             # bay 1
l.carve(24, 14, 31, 20)           # bay 2
l.carve(36, 14, 42, 20)           # the exit bay
l.obj('d1', 'door', 22, 20, 1, 1)
l.obj('d2', 'door', 34, 20, 1, 1)
l.box(22, 19, 22, 19, '#'); l.box(34, 19, 34, 19, '#')
l.d['spawn'] = dict(x=12, y=20); l.d['exit'] = dict(x=41, y=20)
l.hint('h1', 25, 15, 'ONE OF THEM IS BACKWARDS')
l.save()

# ---------------------------------------------------------------- 35
l = L('level35', 'Understudy', 'MIMIC', 46, 26)
l.box(1, 1, 44, 25)               # solid, carve the rooms
# your ledge (stand on row 13), open above
l.carve(1, 1, 32, 13)
l.box(12, 13, 12, 13, '^')
l.box(23, 9, 29, 10); l.box(23, 11, 29, 11, 'v')      # a low spiked beam: no jumping under it
# the crusher shaft and the tunnel beyond (stand on row 18)
l.carve(33, 1, 39, 18)
l.obj('k1', 'crusher', 33, 1, 7, 2, sight=24)
l.carve(40, 17, 44, 18)
l.obj('d1', 'door', 42, 17, 1, 2)
# the mimic's gallery below: rows 21-23, floor 24
l.carve(4, 21, 31, 23)
l.obj('m1', 'mimic', 4, 23)
l.obj('pm', 'plate', 22, 23, 2, 1, target='d1')
l.box(22, 21, 23, 21, 'v')        # spikes right over its plate
l.d['spawn'] = dict(x=8, y=13); l.d['exit'] = dict(x=44, y=18)
l.save()

# ---------------------------------------------------------------- 36
l = L('level36', 'Menagerie', 'MIMIC', 50, 26)
l.box(1, 1, 48, 25)
# the hall (stand on row 13)
l.carve(1, 1, 26, 13)
l.box(22, 9, 26, 10); l.box(22, 11, 26, 11, 'v')      # low spiked beam near the brink
l.box(10, 13, 10, 13, '^')
# the mirror's gallery under the hall: rows 16-18, floor 19; it dies on its plate
l.carve(5, 16, 24, 18)
l.obj('mm', 'mimic', 24, 18, mirror=True)
l.obj('pm', 'plate', 5, 18, 2, 1, target='d1')
l.box(5, 16, 6, 16, 'v')
# the crusher shaft (x27-32) and the corridor beneath (stand on row 22)
l.carve(27, 1, 32, 22)
l.obj('k1', 'crusher', 27, 1, 6, 2, sight=26, rise=3)
l.carve(33, 20, 47, 22)
l.obj('b1', 'brute', 38, 22, 1, 1, patrol=[35, 41], sight=12, sightY=3, dir=-1, pursue=True)
l.obj('d1', 'door', 45, 20, 1, 3)
l.d['spawn'] = dict(x=6, y=13); l.d['exit'] = dict(x=47, y=22)
l.save()

# ================================================================ WORLD 7 — PARADOX
# 'p' tiles are solid only for past selves, 'n' tiles only for the living you. A recording made on
# one kind of ground is replayed on the other.
# ---------------------------------------------------------------- 37
l = L('level37', 'Other Ground', 'PARADOX', 40, 20)
l.box(1, 17, 38, 19)              # ground (stand on row 16)
l.carve(6, 17, 17, 18)            # a trench (stand on row 18)...
l.box(6, 17, 17, 17, 'p')         # ...roofed with ground only the past can walk on
l.box(16, 18, 16, 18, '^')
l.obj('p1', 'plate', 14, 16, 3, 1, target='d1')
l.door('d1', 26, 13, 4)
l.carve(30, 17, 34, 18); l.box(30, 18, 34, 18, '^'); l.box(30, 17, 34, 17, 'n')
l.d['spawn'] = dict(x=3, y=16); l.d['exit'] = dict(x=37, y=16)
l.hint('h1', 4, 6, 'THE PAST STANDS ON OTHER GROUND')
l.save()

# ---------------------------------------------------------------- 38
l = L('level38', 'Trapdoor', 'PARADOX', 40, 18)
l.box(1, 8, 38, 17)               # everything under the corridor (stand on row 7) is rock...
# ...but two sealed cells lie under ground only the living can trust
l.carve(9, 9, 13, 13); l.box(9, 8, 13, 8, 'n'); l.box(9, 13, 11, 13, '^')
l.obj('pa', 'plate', 12, 13, 2, 1, target='da')
l.carve(22, 9, 27, 13); l.box(22, 8, 27, 8, 'n'); l.box(22, 13, 25, 13, '^')
l.obj('pb', 'plate', 26, 13, 2, 1, target='db')
l.box(16, 7, 17, 7, '^')
l.door('da', 19, 4, 4)
l.box(30, 7, 30, 7, '^')
l.door('db', 32, 4, 4)
l.d['spawn'] = dict(x=3, y=7); l.d['exit'] = dict(x=37, y=7)
l.save()

# ---------------------------------------------------------------- 39
l = L('level39', 'Shadow Play', 'PARADOX', 40, 23)
l.box(1, 21, 38, 22)              # ground (stand on row 20)
# the stair only the past can climb, zig-zagging up to a plate
l.box(2, 19, 3, 19, 'p'); l.box(6, 17, 7, 17, 'p'); l.box(10, 15, 11, 15, 'p')
l.box(5, 13, 6, 13, 'p'); l.box(2, 11, 3, 11, 'p')
l.box(7, 9, 12, 9)
l.obj('p1', 'plate', 11, 8, 2, 1, target='d1')
l.box(12, 20, 12, 20, '^')
l.box(13, 1, 13, 16)
l.obj('d1', 'door', 13, 17, 1, 4)
# beyond: a floor of spikes and steps only the living can trust
l.box(15, 20, 38, 20, '^')
l.box(16, 19, 17, 19, 'n'); l.box(20, 17, 21, 17, 'n'); l.box(24, 15, 25, 15, 'n'); l.box(28, 13, 29, 13, 'n')
l.box(32, 11, 38, 11)
l.d['spawn'] = dict(x=5, y=20); l.d['exit'] = dict(x=37, y=10)
l.save()

# ---------------------------------------------------------------- 40
l = L('level40', 'Contradiction', 'PARADOX', 44, 24)
l.box(1, 21, 42, 23)              # ground (stand on row 20)
l.box(9, 19, 9, 20, 'p')          # a wall only the past runs into
# a stair only the past can climb, up to a ledge with a plate
l.box(11, 19, 12, 19, 'p'); l.box(14, 17, 15, 17, 'p'); l.box(17, 15, 18, 15, 'p'); l.box(20, 13, 21, 13, 'p')
l.box(23, 11, 26, 11)
l.obj('pa', 'plate', 25, 10, 2, 1, target='dz')
l.box(27, 1, 27, 10)
# a cell under ground only the living can trust
l.box(30, 21, 34, 21, 'n'); l.carve(30, 22, 34, 22); l.box(30, 22, 32, 22, '^')
l.obj('pb', 'plate', 33, 22, 2, 1, target='dz')
l.box(35, 20, 36, 20, '^')
l.door('dz', 39, 17, 4, require='all')
l.d['spawn'] = dict(x=3, y=20); l.d['exit'] = dict(x=42, y=20)
l.save()

# ================================================================ SPECIAL ROOMS
# ---------------------------------------------------------------- S1
l = L('level41', 'Needle', 'SPECIAL', 40, 30)
l.box(1, 28, 38, 29)              # ground (stand on row 27)
# a grip chimney, spikes on both faces
l.box(13, 6, 13, 24, 'g'); l.box(16, 7, 16, 27, 'g')
l.box(1, 1, 12, 5); l.box(1, 6, 12, 6)
l.box(14, 19, 14, 19, '>'); l.box(15, 16, 15, 16, '<'); l.box(14, 11, 14, 11, '>'); l.box(15, 8, 15, 8, '<')
l.box(17, 6, 38, 27)              # rock under the high corridor (stand on row 5)
l.box(16, 6, 16, 6)
# two spike fields and an island of ground only the living can trust
l.box(19, 5, 23, 5, '^'); l.box(27, 5, 31, 5, '^')
l.box(19, 6, 23, 6); l.box(24, 6, 26, 6, 'n')
l.carve(24, 7, 26, 9); l.box(24, 9, 25, 9, '^')
l.obj('p1', 'plate', 26, 9, 1, 1, target='d1')
l.door('d1', 35, 2, 4)
l.d['spawn'] = dict(x=3, y=27); l.d['exit'] = dict(x=37, y=5)
l.save()

# ---------------------------------------------------------------- S2
l = L('level42', 'Two Staircases', 'SPECIAL', 40, 26)
l.d['solidGhosts'] = True
l.d['loopDuration'] = 12
l.box(1, 25, 38, 25)              # ground (stand on row 24)
l.box(30, 10, 38, 24)             # the plateau (stand on row 9): out of anyone's reach
# the stair of the past, up to a perch against the plateau...
for x, y in ((10, 23), (13, 21), (16, 19), (19, 17), (22, 15)): l.box(x, y, x + 1, y, 'p')
l.box(26, 13, 29, 13, 'p')
# ...and the stair of the living, woven through it, one step short
for x, y in ((7, 23), (10, 21), (13, 19), (16, 17), (19, 15), (25, 14)): l.box(x, y, x + 1, y, 'n')
l.box(1, 24, 2, 24, '^')
l.d['spawn'] = dict(x=4, y=24); l.d['exit'] = dict(x=37, y=9)
l.save()

# ---------------------------------------------------------------- S3
l = L('level43', 'Dead Loop', 'SPECIAL', 48, 25)
l.box(1, 1, 46, 24)               # solid, carve
# the corridor (stand on row 12): two spike fields around an island of living-only ground
l.carve(1, 6, 28, 12)
l.box(8, 12, 12, 12, '^'); l.box(16, 12, 20, 12, '^')
l.box(23, 13, 25, 13, 'n'); l.carve(23, 14, 25, 16); l.box(23, 16, 24, 16, '^')
l.obj('pb', 'plate', 25, 16, 1, 1, target='db')
l.box(26, 12, 26, 12, '^')
l.obj('db', 'door', 28, 6, 1, 7)
# the crusher shaft, and the corridor beneath where something big keeps watch
l.carve(29, 1, 34, 22)
l.obj('k1', 'crusher', 29, 1, 6, 2, sight=26, rise=3)
l.carve(35, 20, 46, 22)
l.obj('b1', 'brute', 40, 22, 1, 1, patrol=[37, 43], sight=12, sightY=3, dir=-1, pursue=True)
l.d['spawn'] = dict(x=3, y=12); l.d['exit'] = dict(x=46, y=22)
l.hint('h1', 3, 8, 'EVERYTHING YOU KNOW')
l.save()

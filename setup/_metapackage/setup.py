import setuptools

with open('VERSION.txt', 'r') as f:
    version = f.read().strip()

setuptools.setup(
    name="odoo14-addons-akretion-odoo-frontapp",
    description="Meta package for akretion-odoo-frontapp Odoo addons",
    version=version,
    install_requires=[
        'odoo14-addon-frontapp_plugin',
    ],
    classifiers=[
        'Programming Language :: Python',
        'Framework :: Odoo',
        'Framework :: Odoo :: 14.0',
    ]
)

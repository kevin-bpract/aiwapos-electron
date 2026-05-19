"""Item / Item Group endpoints."""
from __future__ import annotations

import json
from typing import Iterable

import frappe
from frappe.utils import cint, flt, now_datetime

from ._utils import ok, fail, parse_json_param


# ---------- builders -----------------------------------------------------

def _item_to_dict(item_code: str) -> dict:
    item = frappe.get_doc("Item", item_code)
    price_list = frappe.db.get_single_value("Selling Settings", "selling_price_list") or "Standard Selling"

    current_price = frappe.db.get_value(
        "Item Price",
        {"item_code": item.name, "price_list": price_list, "selling": 1},
        "price_list_rate",
    ) or 0

    prices = [
        dict(
            price_list=p.price_list,
            price_list_rate=flt(p.price_list_rate),
            currency=p.currency or "INR",
            uom=p.uom or item.stock_uom,
            discount_percentage=0,
            discount_amount=0,
        )
        for p in frappe.get_all(
            "Item Price",
            filters={"item_code": item.name, "selling": 1},
            fields=["price_list", "price_list_rate", "currency", "uom"],
        )
    ]

    bins = frappe.get_all(
        "Bin",
        filters={"item_code": item.name},
        fields=["warehouse", "actual_qty"],
    )
    total_stock = sum(flt(b.actual_qty) for b in bins)

    barcodes = [
        dict(barcode=b.barcode, barcode_type=b.barcode_type or "EAN")
        for b in item.get("barcodes") or []
    ]
    uoms = [
        dict(
            uom=u.uom,
            conversion_factor=flt(u.conversion_factor),
            is_default=1 if u.uom == item.stock_uom else 0,
        )
        for u in item.get("uoms") or []
    ]

    tags = []
    raw_tags = item.get("custom_item_tag_list")
    if raw_tags:
        try:
            tags = json.loads(raw_tags)
        except (TypeError, ValueError):
            tags = [t.strip() for t in str(raw_tags).split(",") if t.strip()]

    return dict(
        item_code=item.name,
        name=item.name,
        item_name=item.item_name,
        item_name_arabic=item.get("item_name_arabic"),
        item_group=item.item_group,
        description=item.description or "",
        image=item.image,
        custom_item_tag_list=tags,
        stock_uom=item.stock_uom,
        purchase_uom=item.get("purchase_uom"),
        sales_uom=item.get("sales_uom"),
        standard_rate=flt(item.standard_rate),
        current_price=flt(current_price),
        price_list=price_list,
        item_tax_template=(item.get("taxes") or [{}])[0].get("item_tax_template") if item.get("taxes") else "",
        tax_category=item.get("tax_category") or "",
        tax_rate=0,
        last_purchase_price=None,
        last_purchase_cost=None,
        last_sale_price=None,
        last_sale_to_customer=None,
        warehouse=(bins[0].warehouse if bins else ""),
        warehouse_stock=flt(bins[0].actual_qty) if bins else 0,
        total_stock=total_stock,
        has_variants=cint(item.has_variants),
        variant_of=item.variant_of,
        is_stock_item=cint(item.is_stock_item),
        is_sales_item=cint(item.is_sales_item),
        is_purchase_item=cint(item.is_purchase_item),
        has_batch_no=cint(item.has_batch_no),
        has_serial_no=cint(item.has_serial_no),
        disabled=cint(item.disabled),
        custom_is_favorite=cint(item.get("custom_is_favorite") or 0),
        uoms=uoms,
        prices=prices,
        item_taxes=[],
        stock_by_warehouse=[
            dict(warehouse=b.warehouse, actual_qty=flt(b.actual_qty)) for b in bins
        ],
        barcodes=barcodes,
    )


def _items_for_codes(codes: Iterable[str]) -> list[dict]:
    return [_item_to_dict(c) for c in codes]


# ---------- endpoints ----------------------------------------------------

@frappe.whitelist(methods=["GET"])
def get_items(limit_start: int = 0, limit_page_length: int = 500):
    codes = frappe.get_all(
        "Item",
        filters={"disabled": 0, "is_sales_item": 1},
        pluck="name",
        order_by="modified desc",
        limit_start=cint(limit_start),
        limit_page_length=cint(limit_page_length),
    )
    return _items_for_codes(codes)


@frappe.whitelist(methods=["GET"])
def sync_items(last_sync: str | None = None, limit_start: int = 0, limit_page_length: int = 500):
    filters = {"is_sales_item": 1}
    if last_sync:
        filters["modified"] = [">", last_sync]
    limit_start = cint(limit_start)
    limit_page_length = cint(limit_page_length)
    codes = frappe.get_all(
        "Item",
        filters=filters,
        pluck="name",
        order_by="modified asc",
        limit_start=limit_start,
        limit_page_length=limit_page_length + 1,  # peek for has_more
    )
    has_more = len(codes) > limit_page_length
    codes = codes[:limit_page_length]

    return ok(
        items=_items_for_codes(codes),
        deleted_items=[],  # TODO: maintain deletion log if we ever soft-delete
        server_time=now_datetime().isoformat(),
        has_more=has_more,
        next_offset=limit_start + limit_page_length,
    )


@frappe.whitelist(methods=["GET"])
def sync_stock():
    rows = frappe.db.sql(
        """
        SELECT item_code, SUM(actual_qty) AS actual_qty
        FROM `tabBin`
        GROUP BY item_code
        """,
        as_dict=True,
    )
    return ok(stock=[dict(item_code=r.item_code, actual_qty=flt(r.actual_qty)) for r in rows])


@frappe.whitelist(methods=["GET"])
def get_item_details(item_code: str, customer: str | None = None):
    if not frappe.db.exists("Item", item_code):
        return fail("Item not found")

    item = _item_to_dict(item_code)
    pricing = dict(
        unit_price=item["current_price"],
        price_list=item["price_list"],
        all_prices=item["prices"],
        last_purchase_price=0,
        last_purchase_cost=0,
        last_sale_price=0,
        last_sale_to_customer=0,
    )
    return ok(item=item, pricing=pricing, pricing_visibility={}, tax={})


@frappe.whitelist(methods=["POST"])
def create_item(item_code: str, item_name: str, item_group: str,
                stock_uom: str = "Nos", standard_rate: float = 0,
                description: str | None = None, barcode: str | None = None,
                is_stock_item: int = 1, is_sales_item: int = 1,
                is_purchase_item: int = 0):
    if frappe.db.exists("Item", item_code):
        return fail("Item already exists")

    doc = frappe.new_doc("Item")
    doc.item_code = item_code
    doc.item_name = item_name
    doc.item_group = item_group
    doc.stock_uom = stock_uom
    doc.standard_rate = flt(standard_rate)
    doc.description = description or item_name
    doc.is_stock_item = cint(is_stock_item)
    doc.is_sales_item = cint(is_sales_item)
    doc.is_purchase_item = cint(is_purchase_item)
    if barcode:
        doc.append("barcodes", dict(barcode=barcode, barcode_type="EAN"))
    doc.insert(ignore_permissions=True)

    if flt(standard_rate) > 0:
        _set_item_price(item_code, flt(standard_rate))

    frappe.db.commit()
    return ok(message="Item created", product=_item_to_dict(item_code))


@frappe.whitelist(methods=["POST"])
def update_item(item_code: str, item_name: str | None = None,
                item_group: str | None = None, standard_rate: float | None = None,
                description: str | None = None):
    if not frappe.db.exists("Item", item_code):
        return fail("Item not found")
    doc = frappe.get_doc("Item", item_code)
    if item_name:
        doc.item_name = item_name
    if item_group:
        doc.item_group = item_group
    if description is not None:
        doc.description = description
    if standard_rate is not None:
        doc.standard_rate = flt(standard_rate)
    doc.save(ignore_permissions=True)
    if standard_rate is not None and flt(standard_rate) > 0:
        _set_item_price(item_code, flt(standard_rate))
    frappe.db.commit()
    return ok(message="Item updated")


@frappe.whitelist(methods=["POST"])
def update_item_favorite(item_code: str, is_favorite: int = 1):
    if not frappe.db.exists("Item", item_code):
        return fail("Item not found")
    frappe.db.set_value("Item", item_code, "custom_is_favorite", cint(is_favorite))
    frappe.db.commit()
    return ok(message="Favorite status updated")


@frappe.whitelist(methods=["GET"])
def get_item_groups():
    rows = frappe.get_all(
        "Item Group",
        fields=["name", "parent_item_group", "image"],
        order_by="name asc",
    )
    return ok(item_groups=[
        dict(
            name=r.name,
            parent_item_group=r.parent_item_group,
            image=r.image,
            custom_is_favorite_group=0,
        ) for r in rows
    ])


def _set_item_price(item_code: str, rate: float, price_list: str = "Standard Selling"):
    existing = frappe.db.get_value(
        "Item Price",
        {"item_code": item_code, "price_list": price_list, "selling": 1},
        "name",
    )
    if existing:
        frappe.db.set_value("Item Price", existing, "price_list_rate", rate)
    else:
        doc = frappe.new_doc("Item Price")
        doc.item_code = item_code
        doc.price_list = price_list
        doc.selling = 1
        doc.price_list_rate = rate
        doc.insert(ignore_permissions=True)
